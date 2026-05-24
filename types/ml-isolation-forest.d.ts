declare module 'ml-isolation-forest' {
  export class IsolationForest {
    constructor(options?: { nEstimators?: number })
    train(data: number[][]): void
    predict(data: number[][]): number[]
  }
}
