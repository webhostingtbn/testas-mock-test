'use client';

import React from 'react';
import FigureSequence from '@/components/question-types/FigureSequence';
import MathEquation from '@/components/question-types/MathEquation';
import LatinSquare from '@/components/question-types/LatinSquare';
import CompletingPatterns from '@/components/question-types/CompletingPatterns';
import ModuleMCQ from '@/components/question-types/ModuleMCQ';
import NumericalSeries from '@/components/question-types/NumericalSeries';
import ModuleQuestion from '@/components/question-types/ModuleQuestion';

// ---- Types for renderer ----

export interface QuestionData {
  id: string;
  sectionId: string;
  sortOrder: number;
  questionType: string;
  content: unknown;
  isPassage?: boolean;
  questions?: QuestionData[];
}

export interface RendererProps {
  question: QuestionData;
  selectedAnswer: unknown;
  onAnswer: (answer: unknown, questionId?: string) => void;
  selectedAnswers?: Record<string, string>;
  passage?: QuestionData;
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

// ---- Module Question Types for proper conversion ----

interface ModuleQuestionData {
  id: string;
  sort_order?: number;
  content: {
    question_text: string;
    options: Record<string, string>;
    resolved_image_url?: string;
  };
}

interface ModulePassageData {
  id: string;
  title: string;
  body_markdown: string;
  image_url?: string;
  resolved_image_url?: string;
  questions: ModuleQuestionData[];
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
    return (
      <FigureSequence
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
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
    return (
      <MathEquation
        question={{
          id: question.id,
          content: question.content,
        }}
        currentAnswer={currentAnswer}
        onAnswer={props.onAnswer}
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
    return (
      <LatinSquare
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
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
    return (
      <CompletingPatterns
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
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
    return (
      <NumericalSeries
        question={{
          id: question.id,
          content: question.content,
        }}
        selectedAnswer={selectedAnswer}
        onAnswer={props.onAnswer}
      />
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuidString(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

class ModuleMCQRenderer implements QuestionRenderer {
  canRender(question: QuestionData): boolean {
    const moduleTypes = [
      'module_mcq',
      'interpreting_texts',
      'representation_systems',
      'linguistic_structures',
    ];
    return moduleTypes.includes(question.questionType);
  }

  // Convert QuestionData to ModulePassageData format expected by ModuleMCQ
  private toModulePassage(passage: QuestionData): ModulePassageData {
    const content = isRecord(passage.content) ? passage.content : {};
    const pRecord = passage as unknown as Record<string, unknown>;

    let questions: ModuleQuestionData[];

    if (passage.questions && passage.questions.length > 0) {
      questions = passage.questions.map((q) => {
        const qContent = isRecord(q.content) ? q.content : {};
        const qRecord = q as unknown as Record<string, unknown>;
        const childResolved =
          typeof qRecord.resolved_image_url === 'string'
            ? qRecord.resolved_image_url
            : typeof qContent.resolved_image_url === 'string'
              ? qContent.resolved_image_url
              : undefined;
        return {
          id: q.id,
          sort_order: typeof qRecord.sort_order === 'number' ? qRecord.sort_order : (q.sortOrder ?? 1),
          content: {
            question_text: typeof qContent.question_text === 'string' ? qContent.question_text : '',
            options: (isRecord(qContent.options) || Array.isArray(qContent.options) ? qContent.options : {}) as unknown as Record<string, string>,
            ...(childResolved ? { resolved_image_url: childResolved } : {}),
          },
        };
      });
    } else {
      // Single question passed directly (e.g. Practice Mode)
      const singleResolved =
        typeof pRecord.resolved_image_url === 'string'
          ? pRecord.resolved_image_url
          : typeof content.resolved_image_url === 'string'
            ? content.resolved_image_url
            : undefined;
      questions = [
        {
          id: passage.id,
          sort_order: typeof pRecord.sort_order === 'number' ? pRecord.sort_order : (passage.sortOrder ?? 1),
          content: {
            question_text: typeof content.question_text === 'string' ? content.question_text : (typeof passage.content === 'string' ? passage.content : ''),
            options: (isRecord(content.options) || Array.isArray(content.options) ? content.options : {}) as unknown as Record<string, string>,
            ...(singleResolved ? { resolved_image_url: singleResolved } : {}),
          },
        },
      ];
    }

    let rawTitle = typeof pRecord.title === 'string' ? pRecord.title : (typeof content.title === 'string' ? content.title : (typeof content.passage_title === 'string' ? content.passage_title : undefined));
    if (!rawTitle && passage.sectionId && !isUuidString(passage.sectionId)) {
      rawTitle = passage.sectionId;
    }
    const title = rawTitle || 'Reference Information';

    const bodyMarkdown = typeof pRecord.body_markdown === 'string' ? pRecord.body_markdown : (typeof content.body_markdown === 'string' ? content.body_markdown : (typeof content.passage_markdown === 'string' ? content.passage_markdown : (typeof content.passage_text === 'string' ? content.passage_text : '')));
    const imageUrl = typeof pRecord.image_url === 'string' ? pRecord.image_url : (typeof content.image_url === 'string' ? content.image_url : (typeof content.passage_image_url === 'string' ? content.passage_image_url : undefined));
    const resolvedImageUrl = typeof pRecord.resolved_image_url === 'string' ? pRecord.resolved_image_url : (typeof content.resolved_image_url === 'string' ? content.resolved_image_url : imageUrl);

    return {
      id: passage.id,
      title,
      body_markdown: bodyMarkdown,
      image_url: imageUrl,
      resolved_image_url: resolvedImageUrl,
      questions,
    };
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
    return (
      <ModuleMCQ
        passage={modulePassage}
        selectedAnswers={selectedAnswers}
        onAnswer={(questionId: string, val: string) => {
          props.onAnswer(val, questionId);
        }}
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
        question_text?: string;
        question_image?: string;
        image_url?: string;
        environment_text?: string;
        environment_images?: string[];
        options?: unknown;
        grid_image?: string;
        grid_image_url?: string;
        options_image?: string;
        options_image_url?: string;
      };
    };
    const selectedAnswer = props.selectedAnswer as string | null;
    const isCoreSection = ['solving_quantitative', 'inferring_relationships'].includes(question.questionType);

    // Ensure required fields are always defined with fallbacks
    const contentWithFallbacks = {
      ...question.content,
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
