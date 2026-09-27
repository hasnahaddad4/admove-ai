/**
 * Gradient Boosting Regressor — sequential ensemble of shallow
 * regression trees fit on the residuals (negative gradient) of
 * the squared-error loss.
 *
 *   F_m(x) = F_{m-1}(x) + lr * h_m(x)
 *
 * where h_m is fit to residuals r_i = y_i - F_{m-1}(x_i).
 *
 * Feature importance is aggregated from the regression trees.
 */

import {
  trainDecisionTree,
  predictDecisionTree,
  DecisionTreeModel,
} from './decision-tree';

export interface GradientBoostingModel {
  type: 'gradient-boosting';
  trees: DecisionTreeModel[];
  initValue: number;
  learningRate: number;
  nEstimators: number;
  maxDepth: number;
  featureCount: number;
  featureImportance: number[];
}

export function trainGradientBoosting(
  X: number[][],
  y: number[],
  nEstimators: number = 100,
  maxDepth: number = 4,
  learningRate: number = 0.1,
  minSamplesSplit: number = 10,
  maxFeaturesRatio: number = 0.8,
  seed: number = 42
): GradientBoostingModel {
  const featureCount = X[0].length;
  const maxFeatures = Math.max(1, Math.floor(featureCount * maxFeaturesRatio));

  // Init: mean of y
  const initValue = y.reduce((a, b) => a + b, 0) / y.length;

  // Current predictions
  let currentPreds = new Array(X.length).fill(initValue);

  const trees: DecisionTreeModel[] = [];
  const featureImportance = new Array(featureCount).fill(0);

  // Seeded RNG for feature subsetting
  let rngState = seed;
  const rng = () => {
    rngState |= 0;
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let m = 0; m < nEstimators; m++) {
    // Compute residuals
    const residuals = y.map((yi, i) => yi - currentPreds[i]);

    // Train a shallow tree on residuals
    const originalRandom = Math.random;
    Math.random = rng;
    const tree = trainDecisionTree(
      X,
      residuals,
      maxDepth,
      minSamplesSplit,
      maxFeatures
    );
    Math.random = originalRandom;
    trees.push(tree);

    // Accumulate importance
    for (let i = 0; i < featureCount; i++) {
      featureImportance[i] += tree.featureImportance[i];
    }

    // Update predictions
    const treePreds = predictDecisionTree(tree, X);
    for (let i = 0; i < X.length; i++) {
      currentPreds[i] += learningRate * treePreds[i];
    }
  }

  // Normalize importance
  const totalImp = featureImportance.reduce((a, b) => a + b, 0);
  if (totalImp > 0) {
    for (let i = 0; i < featureCount; i++) {
      featureImportance[i] /= totalImp;
    }
  }

  return {
    type: 'gradient-boosting',
    trees,
    initValue,
    learningRate,
    nEstimators,
    maxDepth,
    featureCount,
    featureImportance,
  };
}

export function predictGradientBoosting(
  model: GradientBoostingModel,
  X: number[][]
): number[] {
  let preds = new Array(X.length).fill(model.initValue);
  for (const tree of model.trees) {
    const treePreds = predictDecisionTree(tree, X);
    for (let i = 0; i < X.length; i++) {
      preds[i] += model.learningRate * treePreds[i];
    }
  }
  return preds;
}
