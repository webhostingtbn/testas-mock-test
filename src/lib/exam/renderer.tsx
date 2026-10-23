'use client';

import React from 'react';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import CompletingPatterns from '@/components/question-types/CompletingPatterns';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';
import NumericalSeries from '@/components/question-types/NumericalSeries';
import ModuleQuestion from '@/components/question-types/ModuleQuestion';
import {
  type QuestionData,
  type ModulePassageData,
  type ModuleQuestionData,
  convertToModulePassage,
  shouldRenderWithModuleMCQ,
} from './passage-helpers';

export {
  type QuestionData,
  type ModulePassageData,
  type ModuleQuestionData,
  convertToModulePassage,
  shouldRenderWithModuleMCQ,
};

// ---- Types for renderer ----

export interface QuestionVerification {
  isVerified: boolean;
  isCorrect: boolean;
  correctAnswer?: unknown;
}

export interface RendererProps {
  question: QuestionData;
  selectedAnswer: unknown;
  onAnswer: (answer: unknown, questionId?: string) => void;
  selectedAnswers?: Record<string, string>;
  passage?: QuestionData;
  verification?: QuestionVerification;
  verifications?: Record<string, QuestionVerification>;
}

// ---- Question Type Discriminator ----

export type QuestionType =
  | 'figure_sequence'
  | 'math_equation'
  | 'latin_square'
  | 'completing_patterns'
  | 'numerical_series'
  | 'module_mcq'
  | 'interpreting_texts'
  | 'representation_systems'
  | 'linguistic_structures'
  | 'solving_quantitative'
  | 'inferring_relationships'
  | 'visualising_solids'
  | 'visualizing_solids'
  | 'visualising solids'
  | 'visualizing solids'
  | 'visualising solids - 2d'
  | 'visualizing solids - 2d'
  | 'visualising solids - 3d'
  | 'visualizing solids - 3d'
  | 'eng_1'
  | 'eng_2_2d'
  | 'eng_2_3d'
  | 'eng_3'
  | 'econ_1'
  | 'econ_2'
  | 'sc_1'
  | 'sc_2';

// ---- Renderer Interface ----

export interface QuestionRenderer {
  canRender(question: QuestionData): boolean;
  render(props: RendererProps): React.ReactNode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getQuestionVerification(
  questionId: string,
  verification?: QuestionVerification,
  verifications?: Record<string, QuestionVerification>
): QuestionVerification | undefined {
  if (verifications && verifications[questionId]) {
    return verifications[questionId];
  }
  return verification;
}

// ---- Individual Renderers ----

class FigureSequenceRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return question.questionType === 'figure_sequence';
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        prompt_image?: string;
        prompt_image_url?: string;
        options?: string[];
        options_urls?: string[];
      };
    };
    const selectedAnswer = props.selectedAnswer as { image1: number | null; image2: number | null } | null;
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);
    return (
      <FigureSequence
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
        verification={verification}
      />
    );
  }
}

class MathEquationRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return question.questionType === 'math_equation';
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        equations: string[];
        variables: string[];
      };
    };
    const currentAnswer = props.selectedAnswer as Record<string, number> | null;
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);
    return (
      <MathEquation
        question={{
          id: question.id,
          content: question.content,
        }}
        currentAnswer={currentAnswer}
        onAnswer={props.onAnswer}
        verification={verification}
      />
    );
  }
}

class LatinSquareRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return question.questionType === 'latin_square';
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        grid_image?: string;
        grid_image_url?: string;
        options?: string[];
      };
    };
    const selectedAnswer = props.selectedAnswer as string | null;
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);
    return (
      <LatinSquare
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
        verification={verification}
      />
    );
  }
}

class CompletingPatternsRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return question.questionType === 'completing_patterns';
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        grid_image_url: string;
        options_image_url: string;
        options_layout?: { rows: number; cols: number; options: string[] };
      };
    };
    const selectedAnswer = props.selectedAnswer as string | null;
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);
    return (
      <CompletingPatterns
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
        verification={verification}
      />
    );
  }
}

class NumericalSeriesRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return question.questionType === 'numerical_series';
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        sequence: (number | string)[];
        target_index?: number;
        prompt?: string;
      };
    };
    const selectedAnswer = props.selectedAnswer as string | null;
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);
    return (
      <NumericalSeries
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
        verification={verification}
      />
    );
  }
}

class ModuleMCQRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    return shouldRenderWithModuleMCQ(question);
  }

  private toModulePassage(passage: QuestionData): ModulePassageData {
    return convertToModulePassage(passage);
  }

  render(props: RendererProps): React.ReactNode {
    const passage = props.passage || props.question;
    const providedAnswers =
      props.selectedAnswers && Object.keys(props.selectedAnswers).length > 0
        ? props.selectedAnswers
        : undefined;
    const selectedAnswers =
      providedAnswers ??
      (typeof props.selectedAnswer === 'object' && props.selectedAnswer !== null
        ? (props.selectedAnswer as Record<string, string>)
        : typeof props.selectedAnswer === 'string'
        ? { [passage.id]: props.selectedAnswer }
        : {});
    const modulePassage = this.toModulePassage(passage);
    const verifications =
      props.verifications ||
      (props.verification ? { [passage.id]: props.verification } : undefined);

    return (
      <ModuleMCQ
        passage={modulePassage}
        selectedAnswers={selectedAnswers}
        onAnswer={(questionId: string, val: string) => {
          props.onAnswer(val, questionId);
        }}
        verifications={verifications}
      />
    );
  }
}

class ModuleQuestionRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    const coreTypes = ['solving_quantitative', 'inferring_relationships'];
    const moduleTypes = [
      'visualising_solids',
      'visualizing_solids',
      'visualising solids',
      'visualizing solids',
      'visualising solids - 2d',
      'visualizing solids - 2d',
      'visualising solids - 3d',
      'visualizing solids - 3d',
      'eng_1',
      'eng_2_2d',
      'eng_2_3d',
      'eng_3',
      'econ_1',
      'econ_2',
      'sc_1',
      'sc_2',
    ];
    return coreTypes.includes(question.questionType) || moduleTypes.includes(question.questionType);
  }

  render(props: RendererProps): React.ReactNode {
    const question = props.question as QuestionData & {
      content: {
        context_text?: string;
        question_text?: string;
        question_image?: string;
        question_image_2?: string;
        question_image_3?: string;
        question_image_a?: string;
        question_image_b?: string;
        question_image_o?: string;
        question_images?: string[];
        resolved_image_url?: string;
        resolved_image_urls?: string[];
        image_url?: string;
        environment_text?: string;
        environment_images?: string[];
        options?: Record<string, unknown> | unknown[];
        grid_image?: string;
        grid_image_url?: string;
        options_image?: string;
        options_image_url?: string;
      };
    };
    const selectedAnswer = props.selectedAnswer as string | null;
    const isCoreSection = ['solving_quantitative', 'inferring_relationships'].includes(question.questionType);
    const verification = getQuestionVerification(question.id, props.verification, props.verifications);

    // Ensure required fields are always defined with fallbacks
    const contentRecord = question.content as Record<string, unknown>;
    const contentWithFallbacks = {
      ...question.content,
      context_text:
        question.content.context_text ||
        (typeof contentRecord.passage_markdown === 'string' ? contentRecord.passage_markdown : undefined),
      question_text: question.content.question_text || '',
      options: question.content.options || {},
    };

    return (
      <ModuleQuestion
        question={{
          id: question.id,
          content: contentWithFallbacks,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={(optionId: string) => props.onAnswer(optionId)}
        isSplitLayout={!isCoreSection}
        verification={verification}
      />
    );
  }
}

// ---- Main Renderer Factory ----

export class QuestionRendererFactory {
  private renderers: QuestionRenderer[];

  constructor() {
    this.renderers = [
      new FigureSequenceRenderer(),
      new MathEquationRenderer(),
      new LatinSquareRenderer(),
      new CompletingPatternsRenderer(),
      new NumericalSeriesRenderer(),
      new ModuleMCQRenderer(),
      new ModuleQuestionRenderer(),
    ];
  }

  getRenderer(question: QuestionData): QuestionRenderer | null {
    for (const renderer of this.renderers) {
      if (renderer.canRender(question)) {
        return renderer;
      }
    }
    return null;
  }

  render(question: QuestionData, props: Omit<RendererProps, 'question'>): React.ReactNode {
    const renderer = this.getRenderer(question);
    if (!renderer) {
      console.error(`No renderer found for question type: ${question.questionType}`);
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          Unknown question type: {question.questionType}
        </div>
      );
    }
    return renderer.render({ ...props, question });
  }
}

// ---- Export singleton instance ----

export const questionRendererFactory = new QuestionRendererFactory();
