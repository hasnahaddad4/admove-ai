/**
 * Model persistence and prediction service.
 *
 * The trained model and metadata are saved as JSON files under /ml/models.
 * The prediction service loads the model on first use and caches it.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LinearRegressionModel, predictLinearRegression } from './linear-regression';
import { DecisionTreeModel, predictDecisionTree } from './decision-tree';
import { RandomForestModel, predictRandomForest } from './random-forest';
import { GradientBoostingModel, predictGradientBoosting } from './gradient-boosting';

export const MODEL_DIR = path.join(process.cwd(), 'ml', 'models');
export const DATA_DIR = path.join(process.cwd(), 'ml', 'data');
export const MODEL_PATH = path.join(MODEL_DIR, 'model.json');
export const METADATA_PATH = path.join(MODEL_DIR, 'model_metadata.json');

export type PersistedModel =
  | { type: 'linear'; model: LinearRegressionModel }
  | { type: 'decision-tree'; model: DecisionTreeModel }
  | { type: 'random-forest'; model: RandomForestModel }
  | { type: 'gradient-boosting'; model: GradientBoostingModel };

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface AllModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
  trainR2: number;
}

export interface ModelMetadata {
  name: string;
  version: string;
  algorithm: string;
  mae: number;
  rmse: number;
  r2: number;
  trainedAt: string;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  featureCount: number;
  featureNames: string[];
  featureImportance: FeatureImportance[];
  allMetrics: Record<string, AllModelMetrics>;
}

export function saveModel(model: PersistedModel, metadata: ModelMetadata): void {
  if (!fs.existsSync(MODEL_DIR)) fs.mkdirSync(MODEL_DIR, { recursive: true });
  fs.writeFileSync(MODEL_PATH, JSON.stringify(model), 'utf-8');
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf-8');
}

let cachedModel: PersistedModel | null = null;
let cachedMetadata: ModelMetadata | null = null;

export function loadModel(): PersistedModel | null {
  if (cachedModel) return cachedModel;
  if (!fs.existsSync(MODEL_PATH)) return null;
  try {
    const raw = fs.readFileSync(MODEL_PATH, 'utf-8');
    cachedModel = JSON.parse(raw) as PersistedModel;
    return cachedModel;
  } catch (e) {
    console.error('Failed to load model:', e);
    return null;
  }
}

export function loadMetadata(): ModelMetadata | null {
  if (cachedMetadata) return cachedMetadata;
  if (!fs.existsSync(METADATA_PATH)) return null;
  try {
    const raw = fs.readFileSync(METADATA_PATH, 'utf-8');
    cachedMetadata = JSON.parse(raw) as ModelMetadata;
    return cachedMetadata;
  } catch (e) {
    console.error('Failed to load metadata:', e);
    return null;
  }
}

export function isModelAvailable(): boolean {
  return loadModel() !== null && loadMetadata() !== null;
}

export interface PredictionInput {
  zone_id: number;
  hour: number;
  day_of_week: number;
  month: number;
  traffic_index: number;
  pedestrian_index: number;
  vehicle_index: number;
  average_speed: number;
  distance: number;
  campaign_duration: number;
  target_audience_match: number;
  historical_exposure: number;
  weather_factor: number;
}

export interface PredictionResult {
  predicted_exposure_score: number;
  confidence: number;
  model_version: string;
  algorithm: string;
  features_used: string[];
}

function predictSingleInternal(model: PersistedModel, features: number[]): number {
  const X = [features];
  switch (model.type) {
    case 'linear':
      return predictLinearRegression(model.model, X)[0];
    case 'decision-tree':
      return predictDecisionTree(model.model, X)[0];
    case 'random-forest':
      return predictRandomForest(model.model, X)[0];
    case 'gradient-boosting':
      return predictGradientBoosting(model.model, X)[0];
  }
}

/**
 * Predict the Potential Exposure Score (0-100) for a given input.
 * Confidence is estimated from the model's R² score.
 */
export function predict(input: PredictionInput): PredictionResult {
  const model = loadModel();
  const metadata = loadMetadata();

  if (!model || !metadata) {
    throw new Error('ML model not available. Please train the model first.');
  }

  const featureOrder = [
    'zone_id',
    'hour',
    'day_of_week',
    'month',
    'traffic_index',
    'pedestrian_index',
    'vehicle_index',
    'average_speed',
    'distance',
    'campaign_duration',
    'target_audience_match',
    'historical_exposure',
    'weather_factor',
  ];

  const features = featureOrder.map((f) => Number((input as any)[f]));
  let raw = predictSingleInternal(model, features);

  // Clamp to [0, 100]
  const predicted = Math.min(100, Math.max(0, raw));

  // Confidence: based on R², scaled. Higher R² => higher confidence.
  const confidence = Math.min(0.99, Math.max(0.3, metadata.r2));

  return {
    predicted_exposure_score: Math.round(predicted * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    model_version: metadata.version,
    algorithm: metadata.algorithm,
    features_used: metadata.featureNames,
  };
}

export function clearModelCache(): void {
  cachedModel = null;
  cachedMetadata = null;
}
