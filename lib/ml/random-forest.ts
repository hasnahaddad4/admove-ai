/**
 * Random Forest Regressor — ensemble of decision trees trained on
 * bootstrap samples with random feature subsetting (bagging).
 *
 * Prediction = average of all tree predictions.
 * Feature importance = average of tree feature importances.
 */

import {
  trainDecisionTree,
  predictDecisionTree,
  DecisionTreeModel,
} from './decision-tree';

export interface RandomForestModel {
  type: 'random-forest';
  trees: DecisionTreeModel[];
  nEstimators: number;
  maxDepth: number;
  minSamplesSplit: number;
  maxFeatures: number;
  featureCount: number;
  featureImportance: number[];
}

function bootstrapSample(
  n: number,
  rng: () => number
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    indices.push(Math.floor(rng() * n));
  }
  return indices;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainRandomForest(
  X: number[][],
  y: number[],
  nEstimators: number = 80,
  maxDepth: number = 10,
  minSamplesSplit: number = 5,
  maxFeaturesRatio: number = 0.7,
  seed: number = 42
): RandomForestModel {
  const featureCount = X[0].length;
  const maxFeatures = Math.max(1, Math.floor(featureCount * maxFeaturesRatio));
  const rng = mulberry32(seed);
  const trees: DecisionTreeModel[] = [];

  for (let t = 0; t < nEstimators; t++) {
    const sampleIdx = bootstrapSample(X.length, rng);
    const Xs = sampleIdx.map((i) => X[i]);
    const ys = sampleIdx.map((i) => y[i]);
    // Override Math.random temporarily for feature subsetting inside tree
    const originalRandom = Math.random;
    Math.random = rng;
    const tree = trainDecisionTree(Xs, ys, maxDepth, minSamplesSplit, maxFeatures);
    Math.random = originalRandom;
    trees.push(tree);
  }

  // Aggregate feature importance
  const featureImportance = new Array(featureCount).fill(0);
  for (const tree of trees) {
    for (let i = 0; i < featureCount; i++) {
      featureImportance[i] += tree.featureImportance[i];
    }
  }
  for (let i = 0; i < featureCount; i++) {
    featureImportance[i] /= trees.length;
  }

  return {
    type: 'random-forest',
    trees,
    nEstimators,
    maxDepth,
    minSamplesSplit,
    maxFeatures,
    featureCount,
    featureImportance,
  };
}

export function predictRandomForest(
  model: RandomForestModel,
  X: number[][]
): number[] {
  const predictions: number[][] = model.trees.map((tree) =>
    predictDecisionTree(tree, X)
  );
  return X.map((_, i) => {
    let sum = 0;
    for (const preds of predictions) sum += preds[i];
    return sum / predictions.length;
  });
}
