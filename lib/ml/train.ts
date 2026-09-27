/**
 * ADM0VE AI — Training Pipeline
 *
 * 1. Generate / load the synthetic dataset
 * 2. Split 80/20 train/test
 * 3. Train 4 models: Linear Regression, Decision Tree, Random Forest, Gradient Boosting
 * 4. Evaluate each (MAE, RMSE, R²)
 * 5. Select the best model by R² (tie-break: lower RMSE)
 * 6. Persist best model + metadata to disk
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateDataset, saveDatasetCSV, loadDatasetCSV, FEATURE_COLUMNS, DatasetRow } from './dataset';
import { computeMetrics, ModelMetrics } from './metrics';
import { trainLinearRegression, predictLinearRegression, LinearRegressionModel } from './linear-regression';
import { trainDecisionTree, predictDecisionTree, DecisionTreeModel } from './decision-tree';
import { trainRandomForest, predictRandomForest, RandomForestModel } from './random-forest';
import { trainGradientBoosting, predictGradientBoosting, GradientBoostingModel } from './gradient-boosting';
import { MODEL_DIR, DATA_DIR, saveModel, ModelMetadata } from './model';

export type AnyModel =
  | { type: 'linear'; model: LinearRegressionModel }
  | { type: 'decision-tree'; model: DecisionTreeModel }
  | { type: 'random-forest'; model: RandomForestModel }
  | { type: 'gradient-boosting'; model: GradientBoostingModel };

export interface TrainingResult {
  metrics: Record<string, ModelMetrics & { trainR2: number }>;
  bestAlgorithm: string;
  bestMetrics: ModelMetrics;
  datasetSize: number;
  featureCount: number;
  featureNames: string[];
  featureImportance: { feature: string; importance: number }[];
  predictions: { actual: number[]; predicted: number[] };
}

function rowToFeatures(row: DatasetRow): number[] {
  return FEATURE_COLUMNS.map((f) => Number(row[f]));
}

function trainTestSplit<T>(arr: T[], testRatio: number, seed: number = 42): [T[], T[]] {
  // Seeded shuffle for reproducibility
  let s = seed;
  const rng = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const splitIdx = Math.floor(shuffled.length * (1 - testRatio));
  return [shuffled.slice(0, splitIdx), shuffled.slice(splitIdx)];
}

export function trainAllModels(datasetSize: number = 10000): TrainingResult {
  // 1. Load or generate dataset
  const datasetPath = path.join(DATA_DIR, 'exposure_dataset.csv');
  let rows: DatasetRow[];

  if (fs.existsSync(datasetPath)) {
    rows = loadDatasetCSV(datasetPath);
    console.log(`Loaded existing dataset: ${rows.length} rows`);
  } else {
    console.log('Generating synthetic dataset...');
    rows = generateDataset(datasetSize, 42);
    saveDatasetCSV(rows, datasetPath);
    console.log(`Dataset saved to ${datasetPath}`);
  }

  // 2. Split
  const [trainRows, testRows] = trainTestSplit(rows, 0.2, 42);
  const XTrain = trainRows.map(rowToFeatures);
  const yTrain = trainRows.map((r) => r.exposure_score);
  const XTest = testRows.map(rowToFeatures);
  const yTest = testRows.map((r) => r.exposure_score);

  console.log(`Train: ${XTrain.length} | Test: ${XTest.length}`);

  const featureNames = FEATURE_COLUMNS.map(String);
  const metrics: TrainingResult['metrics'] = {};

  // 3a. Linear Regression
  console.log('Training Linear Regression...');
  const lrModel = trainLinearRegression(XTrain, yTrain, 1.0);
  const lrTrainPred = predictLinearRegression(lrModel, XTrain);
  const lrTestPred = predictLinearRegression(lrModel, XTest);
  metrics['Linear Regression'] = {
    ...computeMetrics(yTest, lrTestPred),
    trainR2: computeMetrics(yTrain, lrTrainPred).r2,
  };

  // 3b. Decision Tree
  console.log('Training Decision Tree...');
  const dtModel = trainDecisionTree(XTrain, yTrain, 10, 10);
  const dtTrainPred = predictDecisionTree(dtModel, XTrain);
  const dtTestPred = predictDecisionTree(dtModel, XTest);
  metrics['Decision Tree'] = {
    ...computeMetrics(yTest, dtTestPred),
    trainR2: computeMetrics(yTrain, dtTrainPred).r2,
  };

  // 3c. Random Forest
  console.log('Training Random Forest (80 trees)...');
  const rfModel = trainRandomForest(XTrain, yTrain, 80, 10, 5, 0.7, 42);
  const rfTrainPred = predictRandomForest(rfModel, XTrain);
  const rfTestPred = predictRandomForest(rfModel, XTest);
  metrics['Random Forest'] = {
    ...computeMetrics(yTest, rfTestPred),
    trainR2: computeMetrics(yTrain, rfTrainPred).r2,
  };

  // 3d. Gradient Boosting
  console.log('Training Gradient Boosting (100 trees)...');
  const gbModel = trainGradientBoosting(XTrain, yTrain, 100, 4, 0.1, 10, 0.8, 42);
  const gbTrainPred = predictGradientBoosting(gbModel, XTrain);
  const gbTestPred = predictGradientBoosting(gbModel, XTest);
  metrics['Gradient Boosting'] = {
    ...computeMetrics(yTest, gbTestPred),
    trainR2: computeMetrics(yTrain, gbTrainPred).r2,
  };

  // 4. Select best by test R² (tie-break: lower RMSE)
  let bestAlgo = 'Random Forest';
  let bestR2 = -Infinity;
  for (const [algo, m] of Object.entries(metrics)) {
    if (m.r2 > bestR2 || (m.r2 === bestR2 && m.rmse < metrics[bestAlgo].rmse)) {
      bestR2 = m.r2;
      bestAlgo = algo;
    }
  }

  console.log('\n=== Model Comparison ===');
  for (const [algo, m] of Object.entries(metrics)) {
    console.log(`${algo.padEnd(22)} MAE=${m.mae.toFixed(3)}  RMSE=${m.rmse.toFixed(3)}  R²=${m.r2.toFixed(4)}  (train R²=${m.trainR2.toFixed(4)})`);
  }
  console.log(`\nBest model: ${bestAlgo} (R²=${metrics[bestAlgo].r2.toFixed(4)})`);

  // 5. Save best model
  let bestModel: AnyModel;
  let bestFeatureImportance: number[];
  let bestTestPred: number[];

  switch (bestAlgo) {
    case 'Linear Regression':
      bestModel = { type: 'linear', model: lrModel };
      bestFeatureImportance = lrModel.weights.map((w, i) =>
        Math.abs(w) / (lrModel.featureStds[i] || 1)
      );
      bestTestPred = lrTestPred;
      break;
    case 'Decision Tree':
      bestModel = { type: 'decision-tree', model: dtModel };
      bestFeatureImportance = dtModel.featureImportance;
      bestTestPred = dtTestPred;
      break;
    case 'Random Forest':
      bestModel = { type: 'random-forest', model: rfModel };
      bestFeatureImportance = rfModel.featureImportance;
      bestTestPred = rfTestPred;
      break;
    default:
      bestModel = { type: 'gradient-boosting', model: gbModel };
      bestFeatureImportance = gbModel.featureImportance;
      bestTestPred = gbTestPred;
      break;
  }

  // Normalize linear importance
  if (bestAlgo === 'Linear Regression') {
    const total = bestFeatureImportance.reduce((a, b) => a + b, 0);
    if (total > 0) bestFeatureImportance = bestFeatureImportance.map((v) => v / total);
  }

  const bestMetrics = {
    mae: metrics[bestAlgo].mae,
    rmse: metrics[bestAlgo].rmse,
    r2: metrics[bestAlgo].r2,
  };

  const metadata: ModelMetadata = {
    name: 'AdMove Exposure Predictor',
    version: '1.0.0',
    algorithm: bestAlgo,
    mae: bestMetrics.mae,
    rmse: bestMetrics.rmse,
    r2: bestMetrics.r2,
    trainedAt: new Date().toISOString(),
    datasetSize: rows.length,
    trainSize: XTrain.length,
    testSize: XTest.length,
    featureCount: featureNames.length,
    featureNames,
    featureImportance: featureNames.map((f, i) => ({
      feature: f,
      importance: bestFeatureImportance[i] || 0,
    })),
    allMetrics: Object.fromEntries(
      Object.entries(metrics).map(([k, v]) => [
        k,
        { mae: v.mae, rmse: v.rmse, r2: v.r2, trainR2: v.trainR2 },
      ])
    ),
  };

  saveModel(bestModel, metadata);
  console.log(`\nModel saved to ${MODEL_DIR}`);

  return {
    metrics,
    bestAlgorithm: bestAlgo,
    bestMetrics,
    datasetSize: rows.length,
    featureCount: featureNames.length,
    featureNames,
    featureImportance: metadata.featureImportance,
    predictions: {
      actual: yTest,
      predicted: bestTestPred,
    },
  };
}

// CLI entry point
if (require.main === module) {
  const result = trainAllModels(10000);
  console.log('\n=== Training Complete ===');
  console.log(`Best: ${result.bestAlgorithm}`);
  console.log(`MAE: ${result.bestMetrics.mae.toFixed(3)}`);
  console.log(`RMSE: ${result.bestMetrics.rmse.toFixed(3)}`);
  console.log(`R²: ${result.bestMetrics.r2.toFixed(4)}`);
  console.log('\nFeature importance:');
  result.featureImportance
    .sort((a, b) => b.importance - a.importance)
    .forEach((fi) => console.log(`  ${fi.feature.padEnd(24)} ${fi.importance.toFixed(4)}`));
}
