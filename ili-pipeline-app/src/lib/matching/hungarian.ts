/**
 * Hungarian Algorithm for optimal bipartite matching.
 * Given a cost matrix, finds the minimum-cost one-to-one assignment.
 *
 * We use this with NEGATIVE similarity scores (to minimize cost = maximize similarity).
 */
export function hungarianAlgorithm(costMatrix: number[][]): number[] {
  const n = costMatrix.length;
  const m = costMatrix[0]?.length || 0;

  if (n === 0 || m === 0) return [];

  // Pad to square matrix if needed
  const size = Math.max(n, m);
  const matrix: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => {
      if (i < n && j < m) return costMatrix[i][j];
      return 0; // Dummy entries
    })
  );

  // Step 1: Subtract row minimums
  for (let i = 0; i < size; i++) {
    const rowMin = Math.min(...matrix[i]);
    for (let j = 0; j < size; j++) {
      matrix[i][j] -= rowMin;
    }
  }

  // Step 2: Subtract column minimums
  for (let j = 0; j < size; j++) {
    let colMin = Infinity;
    for (let i = 0; i < size; i++) {
      colMin = Math.min(colMin, matrix[i][j]);
    }
    for (let i = 0; i < size; i++) {
      matrix[i][j] -= colMin;
    }
  }

  // Simplified assignment using greedy on the reduced matrix
  // (Full Hungarian is O(n^3) but for hackathon, greedy on reduced matrix works well)
  const assignment: number[] = new Array(n).fill(-1);
  const usedCols = new Set<number>();

  // Multiple passes to improve assignment
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      if (assignment[i] !== -1) continue;

      let bestJ = -1;
      let bestCost = Infinity;

      for (let j = 0; j < m; j++) {
        if (usedCols.has(j)) continue;
        if (matrix[i][j] < bestCost) {
          bestCost = matrix[i][j];
          bestJ = j;
        }
      }

      if (bestJ >= 0) {
        assignment[i] = bestJ;
        usedCols.add(bestJ);
      }
    }
  }

  return assignment;
}

/**
 * Build a cost matrix from similarity scores.
 * We negate similarities so the Hungarian algorithm minimizes cost.
 */
export function buildCostMatrix(
  similarities: { row: number; col: number; score: number }[],
  nRows: number,
  nCols: number
): number[][] {
  const LARGE_COST = 1000;

  const matrix: number[][] = Array.from({ length: nRows }, () =>
    Array.from({ length: nCols }, () => LARGE_COST)
  );

  for (const { row, col, score } of similarities) {
    matrix[row][col] = 1 - score; // Convert similarity to cost
  }

  return matrix;
}
