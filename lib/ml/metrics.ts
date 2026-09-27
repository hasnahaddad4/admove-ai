/** Evaluation metrics for regression models. */

export function mae(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) {
    sum += Math.abs(yTrue[i] - yPred[i]);
  }
  return sum / yTrue.length;
}

export function rmse(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const d = yTrue[i] - yPred[i];
    sum += d * d;
  }
  return Math.sqrt(sum / yTrue.length);
}

export function r2(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) return 0;
  const mean = yTrue.reduce((a, b) => a + b, 0) / yTrue.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < yTrue.length; i++) {
    ssRes += Math.pow(yTrue[i] - yPred[i], 2);
    ssTot += Math.pow(yTrue[i] - mean, 2);
  }
  if (ssTot === 0) return 0;
  return 1 - ssRes / ssTot;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
}

export function computeMetrics(yTrue: number[], yPred: number[]): ModelMetrics {
  return {
    mae: mae(yTrue, yPred),
    rmse: rmse(yTrue, yPred),
    r2: r2(yTrue, yPred),
  };
}
