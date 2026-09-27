/**
 * Linear Regression (Ridge) — closed-form solution via normal equation
 * with L2 regularization for numerical stability.
 *
 *   w = (X^T X + λI)^{-1} X^T y
 *
 * Solves the linear system with Gaussian elimination.
 */

export interface LinearRegressionModel {
  type: 'linear';
  weights: number[];
  bias: number;
  featureMeans: number[];
  featureStds: number[];
  lambda: number;
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Augmented matrix
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        maxRow = r;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) continue; // singular column

    // Eliminate below
    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / aug[col][col];
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = Math.abs(aug[i][i]) < 1e-12 ? 0 : sum / aug[i][i];
  }
  return x;
}

export function trainLinearRegression(
  X: number[][],
  y: number[],
  lambda: number = 1.0
): LinearRegressionModel {
  const n = X.length;
  const d = X[0].length;

  // Standardize features
  const featureMeans = new Array(d).fill(0);
  const featureStds = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += X[i][j];
    featureMeans[j] = sum / n;
    let varSum = 0;
    for (let i = 0; i < n; i++) varSum += Math.pow(X[i][j] - featureMeans[j], 2);
    featureStds[j] = Math.sqrt(varSum / n) || 1;
  }

  const Xs: number[][] = X.map((row) =>
    row.map((v, j) => (v - featureMeans[j]) / featureStds[j])
  );

  // Build X^T X + λI  and X^T y
  const XtX: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  const Xty: number[] = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < d; a++) {
      Xty[a] += Xs[i][a] * y[i];
      for (let b = 0; b < d; b++) {
        XtX[a][b] += Xs[i][a] * Xs[i][b];
      }
    }
  }
  // Add regularization (don't regularize bias, but we handle bias separately)
  for (let a = 0; a < d; a++) XtX[a][a] += lambda;

  const weights = gaussianElimination(XtX, Xty);

  // Bias: since features are standardized, bias = mean(y)
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const bias = yMean;

  return { type: 'linear', weights, bias, featureMeans, featureStds, lambda };
}

export function predictLinearRegression(
  model: LinearRegressionModel,
  X: number[][]
): number[] {
  return X.map((row) => {
    let sum = model.bias;
    for (let j = 0; j < row.length; j++) {
      const v = (row[j] - model.featureMeans[j]) / (model.featureStds[j] || 1);
      sum += model.weights[j] * v;
    }
    return sum;
  });
}
