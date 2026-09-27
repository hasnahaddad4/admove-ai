/**
 * Decision Tree Regressor (CART) — splits on variance reduction (MSE).
 * Supports max depth and min samples split for regularization.
 * Also tracks feature importance via total variance reduction.
 */

export interface DecisionTreeNode {
  isLeaf: boolean;
  value?: number;           // leaf prediction
  feature?: number;         // split feature index
  threshold?: number;       // split threshold
  left?: DecisionTreeNode;  // <= threshold
  right?: DecisionTreeNode; // > threshold
}

export interface DecisionTreeModel {
  type: 'decision-tree';
  root: DecisionTreeNode;
  maxDepth: number;
  minSamplesSplit: number;
  featureCount: number;
  featureImportance: number[];
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function variance(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) * (v - m);
  return s / arr.length;
}

interface Split {
  feature: number;
  threshold: number;
  gain: number;
  leftIdx: number[];
  rightIdx: number[];
}

function findBestSplit(
  X: number[][],
  y: number[],
  indices: number[],
  featureCount: number,
  maxFeatures?: number
): Split | null {
  const n = indices.length;
  if (n < 2) return null;

  const parentVar = variance(indices.map((i) => y[i]));
  if (parentVar === 0) return null;

  // Feature subsetting (for Random Forest)
  let featuresToTry = Array.from({ length: featureCount }, (_, i) => i);
  if (maxFeatures && maxFeatures < featureCount) {
    // Shuffle and take first maxFeatures
    for (let i = featuresToTry.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [featuresToTry[i], featuresToTry[j]] = [featuresToTry[j], featuresToTry[i]];
    }
    featuresToTry = featuresToTry.slice(0, maxFeatures);
  }

  let best: Split | null = null;
  let bestGain = 0;

  for (const f of featuresToTry) {
    // Get sorted unique thresholds for this feature
    const vals = indices.map((i) => X[i][f]).sort((a, b) => a - b);

    // Try candidate thresholds at midpoints (sample to limit cost)
    const candidates: number[] = [];
    const step = Math.max(1, Math.floor(vals.length / 30));
    for (let i = step; i < vals.length; i += step) {
      if (vals[i] !== vals[i - step]) {
        candidates.push((vals[i] + vals[i - step]) / 2);
      }
    }
    if (candidates.length === 0 && vals.length >= 2) {
      candidates.push((vals[0] + vals[vals.length - 1]) / 2);
    }

    for (const threshold of candidates) {
      const leftIdx: number[] = [];
      const rightIdx: number[] = [];
      for (const i of indices) {
        if (X[i][f] <= threshold) leftIdx.push(i);
        else rightIdx.push(i);
      }
      if (leftIdx.length === 0 || rightIdx.length === 0) continue;

      const leftVar = variance(leftIdx.map((i) => y[i]));
      const rightVar = variance(rightIdx.map((i) => y[i]));
      const gain =
        parentVar -
        (leftIdx.length / n) * leftVar -
        (rightIdx.length / n) * rightVar;

      if (gain > bestGain) {
        bestGain = gain;
        best = { feature: f, threshold, gain, leftIdx, rightIdx };
      }
    }
  }

  return best;
}

function buildTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  featureCount: number,
  featureImportance: number[],
  maxFeatures?: number
): DecisionTreeNode {
  const n = indices.length;
  const nodeValue = mean(indices.map((i) => y[i]));

  // Stopping conditions
  if (
    depth >= maxDepth ||
    n < minSamplesSplit ||
    variance(indices.map((i) => y[i])) < 1e-6
  ) {
    return { isLeaf: true, value: nodeValue };
  }

  const split = findBestSplit(X, y, indices, featureCount, maxFeatures);
  if (!split || split.gain <= 0) {
    return { isLeaf: true, value: nodeValue };
  }

  // Accumulate feature importance (weighted by samples * gain)
  featureImportance[split.feature] += (n / X.length) * split.gain;

  return {
    isLeaf: false,
    feature: split.feature,
    threshold: split.threshold,
    left: buildTree(
      X, y, split.leftIdx, depth + 1, maxDepth, minSamplesSplit,
      featureCount, featureImportance, maxFeatures
    ),
    right: buildTree(
      X, y, split.rightIdx, depth + 1, maxDepth, minSamplesSplit,
      featureCount, featureImportance, maxFeatures
    ),
  };
}

export function trainDecisionTree(
  X: number[][],
  y: number[],
  maxDepth: number = 8,
  minSamplesSplit: number = 10,
  maxFeatures?: number
): DecisionTreeModel {
  const featureCount = X[0].length;
  const featureImportance = new Array(featureCount).fill(0);
  const indices = Array.from({ length: X.length }, (_, i) => i);
  const root = buildTree(
    X, y, indices, 0, maxDepth, minSamplesSplit, featureCount, featureImportance, maxFeatures
  );
  // Normalize importance
  const totalImp = featureImportance.reduce((a, b) => a + b, 0);
  if (totalImp > 0) {
    for (let i = 0; i < featureImportance.length; i++) {
      featureImportance[i] /= totalImp;
    }
  }
  return { type: 'decision-tree', root, maxDepth, minSamplesSplit, featureCount, featureImportance };
}

export function predictDecisionTree(
  model: DecisionTreeModel,
  X: number[][]
): number[] {
  return X.map((row) => predictSingle(model.root, row));
}

function predictSingle(node: DecisionTreeNode, row: number[]): number {
  if (node.isLeaf) return node.value!;
  if (row[node.feature!] <= node.threshold!) {
    return predictSingle(node.left!, row);
  }
  return predictSingle(node.right!, row);
}
