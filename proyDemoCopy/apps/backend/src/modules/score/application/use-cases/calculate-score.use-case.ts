import { Injectable } from '@nestjs/common';
// [Use Case CalculateScore]: politica de scoring agregada (post-sesion) | [Patron]: Strategy + Pure Function | [Principio]: SRP | [Paradigma]: Funcional

export interface CalculateScoreInput {
  sessionPoints: number;
  correctCount: number;
  totalQuestions: number;
}

export interface CalculatedScore {
  points: number;
  accuracy: number;
  // [Bono perfeccion]: 20% extra si 100% aciertos
  perfectBonus: number;
}

@Injectable()
export class CalculateScoreUseCase {
  // [execute]: funcion pura, sin side-effects | [Principio]: SRP
  execute(input: CalculateScoreInput): CalculatedScore {
    const accuracy =
      input.totalQuestions > 0 ? input.correctCount / input.totalQuestions : 0;
    const perfectBonus = accuracy === 1 ? input.sessionPoints * 0.2 : 0;
    return {
      points: input.sessionPoints + perfectBonus,
      accuracy,
      perfectBonus,
    };
  }
}
