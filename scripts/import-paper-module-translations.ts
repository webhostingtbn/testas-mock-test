/**
 * Automated Importer for German PaperModule Content
 *
 * Extracts German questions, options, passages, and section translations from:
 *   /Users/rzy/Desktop/ProjectWithTien/Web/testas/PAPER/PaperModule
 * Pairs with English base text, maps to existing database records, validates,
 * and updates public.questions.translations, public.passages.translations,
 * and public.sections.translations.
 *
 * Supported Module Subtests:
 *   - econ_1: Analyzing Economic Interrelationships (Wirtschaftliche Zusammenhänge analysieren)
 *   - sc_1: Analyzing Scientific Relationships (Naturwissenschaftliche Zusammenhänge analysieren)
 *   - sc_2: Understanding Formal Depictions / Analyzing Processes (Formale Darstellungen verstehen / Prozesse analysieren)
 *   - eng_1: Formalizing Technical Interrelationship (Technische Zusammenhänge formalisieren)
 *   - eng_2_2d: Visualizing Solids 2D (Körperansichten erschließen - 2D)
 *   - eng_2_3d: Visualizing Solids 3D (Körperansichten erschließen - 3D)
 *   - eng_3: Analyzing Technical Interrelationships (Technische Zusammenhänge analysieren)
 *
 * Usage:
 *   npx tsx scripts/import-paper-module-translations.ts [--dry-run] [--apply] [--out <path>]
 */

import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import {
  processTranslationPayload,
  computeQuestionSourceHash,
  computePassageSourceHash,
  computeSectionSourceHash,
  getDbClient,
  type TranslationInputPayload,
  type QuestionTranslationItem,
  type PassageTranslationItem,
  type SectionTranslationItem,
  type DbQuestionRow,
  type DbPassageRow,
  type DbSectionRow,
} from './import-translations';
import {
  findTranslationIssues,
  isReviewRequiredType,
} from '../src/lib/i18n/localize';
import {
  extractOptionLetter,
  remapOptionsToDatabaseRow,
  normalizeQuestionStem,
  isRecord,
} from './import-paper-core-translations';

export interface RawParsedQuestion {
  sortOrder: number;
  questionText: string;
  contextText?: string;
  questionImage?: string;
  questionImageA?: string;
  questionImageB?: string;
  options: Array<{ id: string; text?: string; imageUrl?: string }>;
  correctAnswer: string | null;
  passageTag?: string;
  rawContent: Record<string, unknown>;
}

export interface RawParsedPassage {
  tag: string;
  title: string;
  bodyMarkdown: string;
  imageUrl?: string;
  sortOrder: number;
}

export interface GermanPassageDefinition {
  deTitle: string;
  deBodyMarkdown: string;
}

export interface SectionDescriptor {
  type: string;
  deTitle: string;
  deDescription?: string;
}

export const MODULE_SECTION_DESCRIPTORS: Record<string, SectionDescriptor> = {
  econ_1: {
    type: 'econ_1',
    deTitle: 'Wirtschaftliche Zusammenhänge analysieren',
    deDescription: 'Modultest Wirtschaft — Grafiken und Tabellen analysieren (~2 Min. pro Aufgabe)',
  },
  sc_1: {
    type: 'sc_1',
    deTitle: 'Naturwissenschaftliche Zusammenhänge analysieren',
    deDescription: 'Modultest Naturwissenschaften — wissenschaftliche Texte und Diagramme auswerten',
  },
  sc_2: {
    type: 'sc_2',
    deTitle: 'Formale Darstellungen verstehen',
    deDescription: 'Modultest — Flussdiagramme und formale Modelle interpretieren',
  },
  eng_1: {
    type: 'eng_1',
    deTitle: 'Technische Zusammenhänge formalisieren',
    deDescription: 'Modultest Ingenieurwissenschaften — technische Zusammenhänge formal erfassen',
  },
  eng_2_2d: {
    type: 'eng_2_2d',
    deTitle: 'Körperansichten erschließen (2D)',
    deDescription: 'Modultest Ingenieurwissenschaften — 2D-Ansichten dreidimensionaler Körper',
  },
  eng_2_3d: {
    type: 'eng_2_3d',
    deTitle: 'Körperansichten erschließen (3D)',
    deDescription: 'Modultest Ingenieurwissenschaften — 3D-Körperansichten und Schnittansichten',
  },
  eng_3: {
    type: 'eng_3',
    deTitle: 'Technische Zusammenhänge analysieren',
    deDescription: 'Modultest Ingenieurwissenschaften — Diagramme und technische Funktionsabläufe analysieren',
  },
};

/**
 * German translations for all 25 unique passages appearing in the depiction modules.
 * Keys are normalized English titles.
 */
export const GERMAN_PASSAGE_TRANSLATIONS: Record<string, GermanPassageDefinition> = {
  'personality types': {
    deTitle: 'Persönlichkeitstypen',
    deBodyMarkdown:
      'In einem Psychologietest gibt es drei vorgegebene Persönlichkeitstypen (Typ A, Typ B und Typ C). Eine Kombination verschiedener Persönlichkeitsmerkmale führt zur Zuordnung. Die Persönlichkeitsmerkmale sind in der Grafik dargestellt.',
  },
  'vitamins in food': {
    deTitle: 'Vitamine in Lebensmitteln',
    deBodyMarkdown:
      'Gehen Sie bei der Interpretation des folgenden Flussdiagramms davon aus, dass in den sieben möglichen Lebensmitteltypen bis zu drei Vitamine (A, B oder C) enthalten sind.\n\nVon diesen sieben Lebensmitteltypen werden drei als X, Y, Z bezeichnet. X enthält Vitamin A und B, Y enthält Vitamin B und C, Z enthält Vitamin C und A.\n\nDas folgende Flussdiagramm zeigt, welche Vitamine F möglicherweise enthalten kann.',
  },
  'option decision': {
    deTitle: 'Entscheidung zwischen Optionen',
    deBodyMarkdown:
      'Es besteht die Wahl zwischen 3 Optionen (Option 1, Option 2 und Option 3).\n\nDie zu treffende Entscheidung hängt von den Parametern K, L, M und N ab. Das Flussdiagramm zeigt diesen Zusammenhang.',
  },
  'kiosk envelopes': {
    deTitle: 'Kioskumschläge',
    deBodyMarkdown:
      'In einem kleinen Kiosk in London verwenden die Mitarbeiter zwei verschiedene Umschläge für das eingenommene Geld. In den „Kaffeeumschlag“ legen sie das durch den Verkauf von Kaffee eingenommene Geld. Das restliche eingenommene Geld kommt in den „allgemeinen Umschlag“. Am vergangenen Wochenende war ein neuer Mitarbeiter durch die zwei verschiedenen Umschläge verwirrt, und als die Buchhalterin am Montag eintraf, musste sie den Fehler korrigieren und Geld zwischen den beiden Umschlägen austauschen. Beide Umschläge sollten den gleichen Geldbetrag enthalten.',
  },
  'hotel cancellations': {
    deTitle: 'Hotelstornierungen',
    deBodyMarkdown:
      'Ein Hotel in Ägypten hat strenge Richtlinien bezüglich Stornierungen von Reservierungen. Das folgende Flussdiagramm zeigt, welcher Betrag als Stornogebühr oder bei Nichtanreise berechnet wird.',
  },
  'pupil size': {
    deTitle: 'Pupillengröße',
    deBodyMarkdown:
      'Das menschliche Auge passt die Pupillengröße automatisch an die ideale Größe an, wenn sich das einfallende Licht ändert. Ist das einfallende Licht zu stark, verkleinert sich die Pupille; ist das einfallende Licht zu schwach, vergrößert sich die Pupille. Die Grafik beschreibt den Prozess, wie das Auge die Pupillengröße anpasst. Wenn die Pupillengröße des Auges PSa zu groß oder zu klein ist, wird sie verändert, bis die ideale Pupillengröße PSi erreicht ist. Wenn PSi erreicht ist, wird das STOP-Feld angezeigt.',
  },
  'pub tariffs': {
    deTitle: 'Kneipentarife',
    deBodyMarkdown:
      'In einer Kneipe gibt es verschiedene Tarife für All-You-Can-Drink-Angebote. Tarif A beinhaltet weder Bier noch Wein. Tarif B beinhaltet Bier oder Wein, aber keine anderen Getränke. In Tarif C gibt es viele Kombinationen zu berücksichtigen, wie z. B. sowohl Bier als auch Wein oder Bier und Cocktails. Die folgende Grafik zeigt diese Tarife.',
  },
  'traffic sequence': {
    deTitle: 'Vorfahrtsregelung',
    deBodyMarkdown:
      'Auf deutschen Straßen unterscheidet man zwischen Straßen mit Vorfahrt (Hauptstraße) und Straßen ohne Vorfahrt (Nebenstraße).\n\n![Roads 1](https://izcudijmubegczhfcjlw.supabase.co/storage/v1/object/public/ExamDataset/depictions/p_PaperModule8_depiction_21-22a.webp)\n\n![Roads 2](https://izcudijmubegczhfcjlw.supabase.co/storage/v1/object/public/ExamDataset/depictions/p_PaperModule8_depiction_21-22b.webp)\n\nDas folgende Flussdiagramm zeigt, wie ein selbstfahrendes Auto an einer Kreuzung reagieren könnte.',
  },
  'self-driving car flowchart': {
    deTitle: 'Autonomes Fahren an Kreuzungen',
    deBodyMarkdown:
      'Auf deutschen Straßen unterscheidet man zwischen Straßen mit Vorfahrt (Hauptstraße) und Straßen ohne Vorfahrt (Nebenstraße).\n\nDas folgende Flussdiagramm zeigt, wie ein selbstfahrendes Auto an einer Kreuzung reagieren könnte.',
  },
  'exam results': {
    deTitle: 'Prüfungsergebnisse',
    deBodyMarkdown:
      'Die Ergebnisse einer Prüfung werden in 3 Kategorien eingeteilt (Note = M).\n\nM < 50 %; M 50–75 % und M > 75 %.\n\nDer Teilnehmer eines Kurses hat drei Optionen:\n- den Kurs wiederholen\n- die Prüfung wiederholen\n- die Prüfung bestehen\n\nDas folgende Flussdiagramm zeigt, wie eine Entscheidung getroffen werden kann.',
  },
  'university subjects': {
    deTitle: 'Studienfächer',
    deBodyMarkdown:
      'An einer fiktiven Universität gibt es vier Fächer: Kunst, Anglistik, Maschinenbau und Architektur. Im deutschen Notensystem reichen die Noten von 1 bis 6. Je niedriger die Zahl, desto besser die Note! An dieser Universität bestimmen die Schulnoten den Studiengang.\n\nDefinition der Schulnoten:\n- 1 = sehr gute Leistung\n- 2 = gute Leistung\n- 3 = befriedigende, durchschnittliche Leistung\n- 4 = ausreichende Leistung mit leichten Einschränkungen\n- 5 = mangelhafte Leistung (nicht bestanden), Grundkenntnisse sind jedoch vorhanden\n- 6 = ungenügende Leistung (nicht bestanden), Anforderungen wurden nicht erfüllt.\n\nDas Flussdiagramm stellt dar, welche Noten in den Fächern Deutsch, Mathematik, Physik und Englisch zu welchen Entscheidungen führen.',
  },
  'travel packages': {
    deTitle: 'Reisepakete',
    deBodyMarkdown:
      'Das Reiseunternehmen XYZ aus Deutschland möchte seinen Kunden bessere Reisepakete anbieten. Das Flussdiagramm zeigt den Entscheidungsprozess darüber, welches Verkehrsmittel der buchende Kunde bevorzugen wird. Das Unternehmen definiert eine Fernreise als alle Ziele, die entweder außerhalb Deutschlands liegen oder bei denen der Kunde mehr als drei Stunden mit dem Auto vom Startpunkt benötigt.',
  },
  'gardening watering': {
    deTitle: 'Gartenbewässerung',
    deBodyMarkdown:
      'Ein Gärtner hat acht Beete vorbereitet. Um jeder Pflanze die ideale Menge Wasser zu geben, folgt der Gärtner täglich einer Liste. Der Standard beträgt 5 Liter Wasser pro Beet. Der Gärtner berücksichtigt dabei die Temperatur T in °C, Regen (R) in ml/Beet, den Grundwasserspiegel sowie die Sonneneinstrahlung. W entspricht dem Wasser in ml pro Beet.',
  },
  'ice cream selection': {
    deTitle: 'Eisauswahl',
    deBodyMarkdown:
      'Ein Eisverkäufer bietet vier Eissorten an. Wenn sich ein Kunde nicht entscheiden kann, welche Sorte er kaufen möchte, hilft der Verkäufer nach. Er hat ein Verfahren mit mehreren Fragen entwickelt, um die perfekte Eissorte für den Kunden zu finden. Das Flussdiagramm stellt die Fragen und Entscheidungen dar.',
  },
  'decision options wxyz': {
    deTitle: 'Entscheidungsoptionen WXYZ',
    deBodyMarkdown:
      'Es gibt vier Entscheidungsoptionen W, X, Y und Z, die von vier Faktoren F1, F2, F3 und F4 abhängen.\n\nF1 kann den Wert a oder b annehmen. F2 kann den Wert a, b oder c annehmen. F3 kann den Wert a oder c annehmen. Und F4 kann den Wert b oder d annehmen. Das Flussdiagramm stellt dar, welche Faktoren zu welchen Entscheidungen führen.',
  },
  'computer science calculations': {
    deTitle: 'Informatik-Berechnungen',
    deBodyMarkdown:
      'Eine Informatikstudentin hat die Aufgabe erhalten, eine Reihe von Berechnungen als Ablauf darzustellen. Unten sehen Sie ihre fehlerfreie Darstellung.\n\nIm ersten Schritt muss X anhand einer Gleichung gelöst werden. Die nächsten Schritte hängen davon ab, ob X durch eine bestimmte Zahl teilbar ist oder nicht. (Eine Zahl „a“ ist durch eine andere Zahl „b“ teilbar, wenn bei der Division a:b kein Rest bleibt. Beispielsweise ist eine Zahl durch 4 teilbar, wenn ihre letzten beiden Ziffern durch 4 teilbar sind. Somit sind 112, 100, 60 und 36 durch 4 teilbar, 11, 15 und 99 jedoch nicht. Beispiel: 112 / 4 = 28 gegenüber 99 / 4 = 24,75. Nur ganze Zahlen können geteilt werden.)\n\nAnschließend wird geprüft, ob X eine ganze Zahl ist. (Ganze Zahlen sind Zahlen, die hinter dem Komma nur eine Null haben. Beispiele: -200, -4, -3, 0, 1, 2, 300.)\n\nWenn es keine ganze Zahl ist, wird X auf die nächste ganze Zahl (Integer) gerundet. (Um auf die nächste ganze Zahl zu runden, wird die Ziffer hinter dem Komma betrachtet: 0–4 wird abgerundet und 5–9 wird aufgerundet. Beispiel: 72,3 -> 72 und 72,8 -> 73 oder 81,45 -> 81 und 81,51 -> 82.)\n\nDiese Berechnung wird durchgeführt, bis X den Wert 100.000 erreicht.',
  },
  'district municipality improvement': {
    deTitle: 'Stadtteilaufwertung',
    deBodyMarkdown:
      'Eine Stadtbezirksverwaltung möchte das Image des Stadtteils verbessern und höhere Mietpreise verlangen. Dazu werden verschiedene Maßnahmen zur Imageverbesserung des Stadtteils und der Preise berechnet. Ziel ist es, den durchschnittlichen Wohnpreis (ARP) an den optimalen Wohnpreis (ORP) anzupassen. Zu Beginn ist der ARP niedriger als der ORP. Das Diagramm beschreibt den Planungsprozess.',
  },
  'room selection': {
    deTitle: 'Zimmerauswahl',
    deBodyMarkdown:
      'In einer kleinen Pension gibt es drei Zimmer: Zimmer A, Zimmer B, Zimmer C. Zimmer A bietet Platz für sechs Personen und verfügt über eine große Terrasse, Zimmer B bietet Platz für vier Personen und eine kleine Terrasse, und Zimmer C ist das kleinste und preisgünstigste Zimmer. Die Grafik stellt dar, wie ein Zimmer ausgewählt wird.',
  },
  'planet suitability': {
    deTitle: 'Eignung von Planeten',
    deBodyMarkdown:
      'Wissenschaftler versuchen, einen anderen Planeten zu finden, auf dem Menschen überleben können. Sie haben mehrere Planeten entdeckt, die geeignet sein könnten. Anhand einiger wichtiger Kriterien wie dem Vorhandensein von Sauerstoff (O) in der Atmosphäre, der Temperatur (T) und der allgemeinen Umweltbedingungen (E) bestimmen sie, ob diese Planeten für Menschen, kleinere Lebewesen und Bakterien bewohnbar sind. Menschen können bei Temperaturen von bis zu 60 Grad Celsius überleben und benötigen mindestens 20 % Sauerstoff in der Atmosphäre. Kleinere Lebewesen können bei Temperaturen von bis zu 80 Grad Celsius überleben, solange der Sauerstoffanteil mindestens 10 % der Luft ausmacht. Bakterien benötigen weit weniger günstige Bedingungen zum Überleben. Solange der Sauerstoffgehalt bei 5 % liegt, überleben einige Bakterienstämme. Das bedeutet: Wenn Menschen überleben können, überleben kleinere Lebewesen und Bakterien in jedem Fall. (Bitte beachten Sie, dass die Werte in dieser Aufgabe rein fiktiv sind und keine tatsächlichen Überlebensbedingungen darstellen.)\n\nDas folgende Flussdiagramm zeigt, wie die Wissenschaftler die Eignung des Planeten bestimmen:',
  },
  'thermostat algorithm': {
    deTitle: 'Thermostat-Algorithmus',
    deBodyMarkdown:
      'Das Thermostat unserer Zentralheizung verwendet einen einfachen Algorithmus zur Regelung der Heizung und der Temperatur im Haus. Ein Paar hat die Temperatur auf 27 Grad Celsius eingestellt, und das Thermostat muss die Heizung je nach Raumtemperatur verringern oder erhöhen. Das folgende Flussdiagramm zeigt den Ablauf, nach dem das Thermostat die Temperatur des Hauses regelt.',
  },
  'substances and symptoms': {
    deTitle: 'Wirkstoffe und Symptome',
    deBodyMarkdown:
      'Aa, Ab, Ad und Ae sind Wirkstoffe.\n- Aa und Ab helfen gegen Kopfschmerzen\n- Aa und Ad helfen gegen Magenschmerzen\n- Ab und Ae helfen gegen Muskelschmerzen\n\nDas Flussdiagramm stellt dar, welche Wirkstoffe bei welchen Symptomen eingenommen werden sollen. Dabei entspricht der einzunehmende Wirkstoff immer genau dem Wirkstoff, der für die angegebenen Symptome vorgesehen ist.',
  },
  'lawn growth': {
    deTitle: 'Rasenwachstum',
    deBodyMarkdown:
      'Das Gras eines Rasens wächst umso langsamer, je länger es wird. Die folgende grafische Darstellung veranschaulicht das Wachstum des Rasens. Die Länge des Grases L wird in cm und das Wachstum des Grases W in mm/Tag angegeben.',
  },
  'plant growth factors': {
    deTitle: 'Pflanzenwachstumsfaktoren',
    deBodyMarkdown:
      'Vier Pflanzen reagieren auf drei Faktoren: Temperatur (T), Licht (L) und Luftfeuchtigkeit (H).\n- Wenn die Temperatur erhöht wird, ist bei den Pflanzen Pn und Ac ein schnelleres Wachstum zu beobachten.\n- Wenn die Luftfeuchtigkeit erhöht wird, wachsen die Pflanzen Ec und Ac deutlich schneller. Ec reagiert auf keinen anderen Faktor.\n- Wenn die Lichtintensität erhöht wird, sind bei den Pflanzen Fm und Pn größere Wachstumsänderungen zu beobachten.\n\nIn einem Experiment lässt sich das Wachstum in Abhängigkeit von T, L und H nachweisen. Das Flussdiagramm zeigt mehrere Zusammenhänge.',
  },
  'parameter flow chart 1': {
    deTitle: 'Parameter-Flussdiagramm 1',
    deBodyMarkdown:
      'Flussdiagramm zur Bestimmung der Ausgabeparameter basierend auf den Eingangswerten.',
  },
  'parameter flow chart 2': {
    deTitle: 'Parameter-Flussdiagramm 2',
    deBodyMarkdown: 'Die Parameter des Flussdiagramms sind immer ganze Zahlen.',
  },
  'sars and h3n2 study': {
    deTitle: 'SARS- und H3N2-Studie',
    deBodyMarkdown:
      'SARS und die H3N2-Grippe sind zwei Krankheiten, die in den vergangenen Jahren in einigen Regionen der Welt eine hohe Sterblichkeitsrate aufwiesen. Je nach Wohnsitzland waren die Einwohner entweder beiden Krankheiten, nur einer der Krankheiten oder keiner der Krankheiten ausgesetzt.\n\nFür unsere Studie haben wir vier Länder zufällig ausgewählt. Die folgende Tabelle zeigt, ob diese Länder in hohem oder geringem Maße von den beiden Krankheiten betroffen sind.\n\n| Algerien | Niedriges SARS-Niveau | Niedriges H3N2-Niveau |\n|---|---|---|\n| Belgien | Hohes SARS-Niveau | Hohes H3N2-Niveau |\n| Malaysia | Hohes SARS-Niveau | Niedriges H3N2-Niveau |\n| Norwegen | Niedriges SARS-Niveau | Hohes H3N2-Niveau |\n\nDas folgende Flussdiagramm zeigt die statistischen Daten für vier Länder in Bezug auf die beiden Krankheiten.',
  },
};

/**
 * Normalizes SQL content by replacing non-breaking spaces and line endings.
 */
export function sanitizeSql(raw: string): string {
  return raw.replace(/\u00A0/g, ' ').replace(/\r\n/g, '\n');
}

/**
 * Parses questions from any PaperModule SQL file (supporting both single-quoted
 * and dollar-quoted JSON tuples).
 */
export function parsePaperModuleQuestions(filePath: string): RawParsedQuestion[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = sanitizeSql(fs.readFileSync(filePath, 'utf8'));
  const results: RawParsedQuestion[] = [];
  let idx = 0;

  while (true) {
    const jsonStart = content.indexOf('{\n', idx);
    if (jsonStart === -1) break;

    let braceCount = 0;
    let end = -1;
    let inString = false;
    let escape = false;

    for (let i = jsonStart; i < content.length; i++) {
      const ch = content[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (ch === '{') braceCount++;
        else if (ch === '}') {
          braceCount--;
          if (braceCount === 0) {
            end = i;
            break;
          }
        }
      }
    }

    if (end !== -1) {
      let jsonStr = content.substring(jsonStart, end + 1);

      // Handle unescaped single quote escaping inside single-quoted SQL (e.g. '' -> ')
      // but note that JSON itself uses standard JSON quotes
      try {
        const obj = JSON.parse(jsonStr);
        if (!isRecord(obj)) continue;
        if (obj.question_text || obj.options) {
          const prefix = content.substring(Math.max(0, jsonStart - 80), jsonStart);
          const orderMatch =
            prefix.match(/(?:\(|\b)(\d+)\s*,\s*(?:\$\$)?\s*$/) ||
            prefix.match(/\(\s*(\d+)\s*,\s*$/) ||
            prefix.match(/,\s*(\d+)\s*,\s*$/);
          const sortOrder = orderMatch
            ? parseInt(orderMatch[1], 10)
            : results.length + 1;

          const passageTagMatch = prefix.match(
            /\(\s*\(\s*SELECT\s+id\s+FROM\s+(p\d+)\s*\)/i,
          );
          const passageTag = passageTagMatch ? passageTagMatch[1] : undefined;

          // Answer match after closing brace
          const postChunk = content.substring(end + 1, Math.min(content.length, end + 50));
          const ansMatch = postChunk.match(/^,?\s*(?:\$\$|')?\s*,?\s*(?:'|")?([A-Ea-e0-9_-]+?)(?:'|")?\s*\)/);
          const correctAnswer = ansMatch ? ansMatch[1] : null;

          const options: Array<{ id: string; text?: string; imageUrl?: string }> = [];
          if (Array.isArray(obj.options)) {
            for (const opt of obj.options) {
              if (opt && typeof opt === 'object') {
                const optObj = opt as Record<string, unknown>;
                const id = typeof optObj.id === 'string' ? optObj.id.trim() : '';
                const text = typeof optObj.text === 'string' ? optObj.text.trim() : undefined;
                const imageUrl = typeof optObj.image_url === 'string' ? optObj.image_url.trim() : undefined;
                if (id) {
                  options.push({ id, text, imageUrl });
                }
              }
            }
          }

          results.push({
            sortOrder,
            passageTag,
            questionText: typeof obj.question_text === 'string' ? obj.question_text.trim() : '',
            contextText: typeof obj.context_text === 'string' ? obj.context_text.trim() : undefined,
            questionImage:
              typeof obj.question_image === 'string' && obj.question_image.trim() !== ''
                ? obj.question_image.trim()
                : undefined,
            questionImageA:
              typeof obj.question_image_a === 'string' && obj.question_image_a.trim() !== ''
                ? obj.question_image_a.trim()
                : undefined,
            questionImageB:
              typeof obj.question_image_b === 'string' && obj.question_image_b.trim() !== ''
                ? obj.question_image_b.trim()
                : undefined,
            options,
            correctAnswer,
            rawContent: obj,
          });
        }
      } catch (err) {
        // If strict JSON parse failed, continue
      }
      idx = end + 1;
    } else {
      idx = jsonStart + 1;
    }
  }

  return results;
}

/**
 * Parses passage definitions from depiction SQL files.
 */
export function parsePaperModulePassages(filePath: string): RawParsedPassage[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = sanitizeSql(fs.readFileSync(filePath, 'utf8'));
  const passages: RawParsedPassage[] = [];
  const regex =
    /(p\d+)\s+AS\s+\(\s*INSERT INTO public\.passages\s*\([^)]+\)\s*SELECT\s+id,\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*'((?:''|[^'])*)',\s*(\d+)/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(content))) {
    passages.push({
      tag: m[1],
      title: m[2].replace(/''/g, "'"),
      bodyMarkdown: m[3].replace(/''/g, "'"),
      imageUrl: m[4].replace(/''/g, "'"),
      sortOrder: parseInt(m[5], 10),
    });
  }

  return passages;
}

export interface MatchedModuleQuestionResult {
  dbId: string;
  examTitle: string;
  sectionTitle: string;
  questionType: string;
  translation: QuestionTranslationItem;
}

export interface MatchedModulePassageResult {
  dbId: string;
  examTitle: string;
  sectionTitle: string;
  translation: PassageTranslationItem;
}

export interface ModuleFolderConfig {
  gerDir: string;
  engDir: string;
  type: string;
}

export const MODULE_FOLDER_CONFIGS: ModuleFolderConfig[] = [
  {
    gerDir: 'Economics & mathematics, com science/GER/econ_GER',
    engDir: 'Economics & mathematics, com science/ENG/econ',
    type: 'econ_1',
  },
  {
    gerDir: 'Economics & mathematics, com science/GER/nscs_GER',
    engDir: 'Economics & mathematics, com science/ENG/nscs',
    type: 'sc_1',
  },
  {
    gerDir: 'Economics & mathematics, com science/GER/depiction_GER',
    engDir: 'Economics & mathematics, com science/ENG/depiction',
    type: 'sc_2',
  },
  {
    gerDir: 'Engineering/GER/eng_GER',
    engDir: 'Engineering/ENGLISH/eng',
    type: 'eng_1',
  },
  {
    gerDir: 'Engineering/GER/eng_2_2d_GER',
    engDir: 'Engineering/ENGLISH/eng_2_2d',
    type: 'eng_2_2d',
  },
  {
    gerDir: 'Engineering/GER/eng_2_3d_GER',
    engDir: 'Engineering/ENGLISH/eng_2_3d',
    type: 'eng_2_3d',
  },
  {
    gerDir: 'Engineering/GER/eng_3_GER',
    engDir: 'Engineering/ENGLISH/eng_3',
    type: 'eng_3',
  },
];

export async function buildPaperModuleTranslations(
  client: Client,
  baseDir: string,
): Promise<{
  payload: TranslationInputPayload;
  matchedQuestions: MatchedModuleQuestionResult[];
  matchedPassages: MatchedModulePassageResult[];
  dbQuestionsMap: Map<string, DbQuestionRow>;
  dbPassagesMap: Map<string, DbPassageRow>;
  dbSectionsMap: Map<string, DbSectionRow>;
}> {
  // 1. Fetch questions, passages, and sections
  const questionsRes = await client.query<
    DbQuestionRow & {
      exam_title: string;
      section_title: string;
      sort_order: number;
      passage_id: string | null;
    }
  >(`
    SELECT 
      q.id, 
      q.section_id,
      q.sort_order,
      q.question_type, 
      q.content, 
      q.translations,
      q.passage_id,
      e.title as exam_title,
      s.title as section_title
    FROM public.questions q
    JOIN public.sections s ON q.section_id = s.id
    JOIN public.exams e ON s.exam_id = e.id
    WHERE e.format = 'Paper'
      AND s.question_type IN ('econ_1', 'sc_1', 'sc_2', 'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3')
    ORDER BY s.question_type, e.title, q.sort_order
  `);

  const passagesRes = await client.query<
    DbPassageRow & {
      exam_title: string;
      section_title: string;
      question_type: string;
      image_url: string | null;
      sort_order: number;
    }
  >(`
    SELECT 
      p.id, 
      p.section_id, 
      p.title, 
      p.body_markdown, 
      p.image_url, 
      p.sort_order, 
      p.translations,
      e.title as exam_title,
      s.title as section_title,
      s.question_type
    FROM public.passages p
    JOIN public.sections s ON p.section_id = s.id
    JOIN public.exams e ON s.exam_id = e.id
    WHERE e.format = 'Paper'
      AND s.question_type = 'sc_2'
    ORDER BY e.title, p.sort_order
  `);

  const sectionsRes = await client.query<
    DbSectionRow & { exam_title: string }
  >(`
    SELECT 
      s.id, 
      s.exam_id,
      s.title, 
      s.description, 
      s.question_type, 
      s.environment_content, 
      s.translations,
      e.title as exam_title
    FROM public.sections s
    JOIN public.exams e ON s.exam_id = e.id
    WHERE e.format = 'Paper'
      AND s.question_type IN ('econ_1', 'sc_1', 'sc_2', 'eng_1', 'eng_2_2d', 'eng_2_3d', 'eng_3')
    ORDER BY s.question_type, e.title
  `);

  const dbQuestionsMap = new Map<string, DbQuestionRow>();
  for (const q of questionsRes.rows) {
    dbQuestionsMap.set(q.id, q);
  }

  const dbPassagesMap = new Map<string, DbPassageRow>();
  for (const p of passagesRes.rows) {
    dbPassagesMap.set(p.id, p);
  }

  const dbSectionsMap = new Map<string, DbSectionRow>();
  for (const s of sectionsRes.rows) {
    dbSectionsMap.set(s.id, s);
  }

  const matchedQuestions: MatchedModuleQuestionResult[] = [];
  const questionTranslations: QuestionTranslationItem[] = [];
  const processedQIds = new Set<string>();

  // 2. Match Questions
  for (const cfg of MODULE_FOLDER_CONFIGS) {
    const gerFullDir = path.join(baseDir, cfg.gerDir);
    const engFullDir = path.join(baseDir, cfg.engDir);

    if (!fs.existsSync(gerFullDir)) {
      console.warn(`[WARN] Directory not found: ${gerFullDir}`);
      continue;
    }

    const gerFiles = fs.readdirSync(gerFullDir).filter((f) => f.endsWith('.sql'));
    const dbTypeRows = questionsRes.rows.filter((q) => q.question_type === cfg.type);

    for (const f of gerFiles) {
      const gerPath = path.join(gerFullDir, f);
      const gerQuestions = parsePaperModuleQuestions(gerPath);
      const gerPassages = parsePaperModulePassages(gerPath);
      const passageTagMap = new Map<string, string>();
      for (const p of gerPassages) {
        passageTagMap.set(p.tag.toLowerCase(), p.title.trim().toLowerCase());
      }

      const engFileName = f.replace(/_GER\.sql$/i, '.sql');
      const engPath = path.join(engFullDir, engFileName);
      const engQuestions = fs.existsSync(engPath)
        ? parsePaperModuleQuestions(engPath)
        : [];

      const modMatch = f.match(/PaperModule_?(\d+)/i);
      const modNum = modMatch ? parseInt(modMatch[1], 10) : null;

      for (let i = 0; i < gerQuestions.length; i++) {
        const gq = gerQuestions[i];
        const eq = engQuestions[i];

        // Find candidate DB rows that match this question
        for (const row of dbTypeRows) {
          if (processedQIds.has(row.id)) continue;

          const c = isRecord(row.content) ? row.content : null;
          if (!c) continue;

          let isMatch = false;

          // 0. Explicit mapping for Paper Test Suit 1, 7, 8
          if (row.exam_title === 'Paper Test Suit 1') {
            const suit1FileMap: Record<string, string> = {
              econ_1: 'PaperModule3_econ_GER.sql',
              sc_1: 'PaperModule4_nscs_GER.sql',
              eng_1: 'PaperModule3_eng_GER.sql',
              eng_3: 'PaperModule3_eng_3_GER.sql',
              sc_2: 'Papermodule8_depiction_GER.sql',
            };
            const expectedFile = suit1FileMap[cfg.type];
            if (expectedFile && f === expectedFile && row.sort_order === gq.sortOrder) {
              isMatch = true;
            }
          } else if (row.exam_title === 'Paper Test Suit 7' && cfg.type === 'sc_2') {
            if (f === 'PaperModule9_depiction_GER.sql' && row.sort_order === gq.sortOrder) {
              isMatch = true;
            }
          } else if (row.exam_title === 'Paper Test Suit 8' && cfg.type === 'sc_2') {
            if (f === 'PaperModule10_depiction_GER.sql' && row.sort_order === gq.sortOrder) {
              isMatch = true;
            }
          }

          // 1. Exact or partial stem matching
          if (!isMatch && eq && (eq.questionText || eq.contextText) && (c.question_text || c.context_text)) {
            const dbQ = typeof c.question_text === 'string' ? c.question_text : '';
            const dbCtx = typeof c.context_text === 'string' ? c.context_text : '';
            const dbFullStem = normalizeQuestionStem((dbCtx ? dbCtx + ' ' : '') + dbQ);
            const dbStem = normalizeQuestionStem(dbQ);

            const eqQ = eq.questionText || '';
            const eqCtx = eq.contextText || '';
            const eqFullStem = normalizeQuestionStem((eqCtx ? eqCtx + ' ' : '') + eqQ);
            const eqStem = normalizeQuestionStem(eqQ);

            if (
              dbStem === eqStem ||
              dbFullStem === eqFullStem ||
              dbStem === eqFullStem ||
              dbFullStem === eqStem ||
              (eqStem.length > 35 && dbStem.includes(eqStem)) ||
              (dbStem.length > 35 && eqStem.includes(dbStem))
            ) {
              isMatch = true;
            }
          }

          // 2. Option image match (for 2D)
          if (!isMatch && Array.isArray(eq?.options) && Array.isArray(c?.options) && eq.options.length > 0 && c.options.length > 0) {
            const eqFirstOpt = eq.options[0];
            const dbFirstOpt = isRecord(c.options[0]) ? c.options[0] : null;
            const eqFirstImg = eqFirstOpt?.imageUrl ? path.basename(eqFirstOpt.imageUrl) : undefined;
            const dbFirstImg = typeof dbFirstOpt?.image_url === 'string' ? path.basename(dbFirstOpt.image_url) : undefined;
            if (eqFirstImg && dbFirstImg && eqFirstImg === dbFirstImg) {
              isMatch = true;
            }
          }

          // 3. Question image match (by basename)
          if (!isMatch) {
            const eqImg = (eq?.questionImage || gq?.questionImage)
              ? path.basename(eq?.questionImage || gq?.questionImage || '')
              : undefined;
            const dbImg = typeof c?.question_image === 'string' ? path.basename(c.question_image) : undefined;
            if (eqImg && dbImg && eqImg === dbImg) {
              isMatch = true;
            }
          }

          // 4. Module number + sort_order match for visual subtests (eng_2_2d, eng_2_3d)
          if (!isMatch && modNum !== null && (cfg.type === 'eng_2_2d' || cfg.type === 'eng_2_3d')) {
            const examNumMatch = row.exam_title.match(/Paper Test Suit\s+(\d+)/i);
            const examNum = examNumMatch ? parseInt(examNumMatch[1], 10) : null;
            if (examNum === modNum && row.sort_order === gq.sortOrder) {
              isMatch = true;
            }
          }

          // 5. Direct module-to-suit offset match (modNum -> Paper Test Suit modNum + 1)
          if (!isMatch && modNum !== null && (cfg.type === 'econ_1' || cfg.type === 'sc_1' || cfg.type === 'eng_1' || cfg.type === 'eng_3')) {
            const examNumMatch = row.exam_title.match(/Paper Test Suit\s+(\d+)/i);
            const examNum = examNumMatch ? parseInt(examNumMatch[1], 10) : null;
            if (examNum === modNum + 1 && row.sort_order === gq.sortOrder) {
              isMatch = true;
            }
          }

          if (isMatch) {
            // Prepare German translation item
            const baseQText = typeof c.question_text === 'string' ? c.question_text : '';
            const baseHasNumbering = /^\d+(\.\d+)?\s*/.test(baseQText) || /^Question\s+\d+(\.\d+)?\s*/i.test(baseQText);

            let gerQuestionText = gq.questionText;

            // Handle numbering prefix alignment
            if (!baseHasNumbering) {
              gerQuestionText = gerQuestionText
                .replace(/^Question\s+\d+(\.\d+)?\.?\s*/i, '')
                .replace(/^\d+(\.\d+)?\.?\s*/, '')
                .trim();
            }

            // 1. If German has contextText, always prepend it if not already in gerQuestionText
            if (gq.contextText && !gerQuestionText.includes(gq.contextText)) {
              gerQuestionText = `${gq.contextText}\n\n${gerQuestionText}`;
            }

            // 2. If standalone question (no passage_id) but has passageTag (e.g. Paper Test Suit 1 sc_2 Q1-Q20),
            // prepend the German passage body markdown as problem description/scenario
            if (!row.passage_id && gq.passageTag) {
              const pTitle = passageTagMap.get(gq.passageTag.toLowerCase());
              if (pTitle && GERMAN_PASSAGE_TRANSLATIONS[pTitle]) {
                const dePassage = GERMAN_PASSAGE_TRANSLATIONS[pTitle];
                if (!gerQuestionText.includes(dePassage.deBodyMarkdown)) {
                  gerQuestionText = `${dePassage.deBodyMarkdown}\n\n${gerQuestionText}`;
                }
              }
            }

            // Remap options
            const gerOptList = gq.options.map((o) => ({
              id: o.id,
              text: o.text ?? '',
            }));
            const remappedOptions = remapOptionsToDatabaseRow(row.content, gerOptList);

            const qItem: QuestionTranslationItem = {
              id: row.id,
              question_text: gerQuestionText,
            };

            // Only attach options if there are text options
            const hasBaseTextOptions =
              Array.isArray(c.options) &&
              c.options.some(
                (opt) =>
                  isRecord(opt) &&
                  typeof opt.text === 'string' &&
                  opt.text.trim() !== '',
              );

            if (hasBaseTextOptions || Object.keys(remappedOptions).length > 0) {
              qItem.options = remappedOptions;
            }

            if (gq.questionImage) {
              let img = gq.questionImage;
              img = img.replace(/\/ExamDataset\/eng\//g, '/ExamDataset/p_eng_1/');
              img = img.replace(/\/ExamDataset\/p_eng_1\/(p_PaperModule\d+_eng_2_2d_[^"]+)/g, '/ExamDataset/p_eng_2/$1');
              img = img.replace(/\/ExamDataset\/depiction\//g, '/ExamDataset/depictions/');
              img = img.replace(/\/depictions\/([^"]+)\.jpeg/g, '/depictions/$1.webp');
              qItem.question_image = img;
            }

            matchedQuestions.push({
              dbId: row.id,
              examTitle: row.exam_title,
              sectionTitle: row.section_title,
              questionType: row.question_type,
              translation: qItem,
            });

            questionTranslations.push(qItem);
            processedQIds.add(row.id);
          }
        }
      }
    }
  }

  // 3. Match Passages for sc_2
  const matchedPassages: MatchedModulePassageResult[] = [];
  const passageTranslations: PassageTranslationItem[] = [];

  // Passage title fallback maps for Paper Test Suit 7 and Paper Test Suit 8 (which have generic DB titles)
  const SUIT_7_PASSAGE_ORDER: string[] = [
    'exam results',
    'university subjects',
    'travel packages',
    'gardening watering',
    'ice cream selection',
    'decision options wxyz',
    'computer science calculations',
    'district municipality improvement',
  ];

  const SUIT_8_PASSAGE_ORDER: string[] = [
    'room selection',
    'planet suitability',
    'thermostat algorithm',
    'substances and symptoms',
    'lawn growth',
    'plant growth factors',
    'parameter flow chart 1',
    'parameter flow chart 2',
    'sars and h3n2 study',
  ];

  for (const pRow of passagesRes.rows) {
    if (!pRow.title) continue;
    const baseTitle = pRow.title.trim().toLowerCase();
    let deDef = GERMAN_PASSAGE_TRANSLATIONS[baseTitle];

    // Fallback matching by sort_order for Suit 7 and Suit 8 (generic titles)
    if (!deDef) {
      if (
        pRow.exam_title === 'Paper Test Suit 7' &&
        pRow.sort_order >= 1 &&
        pRow.sort_order <= SUIT_7_PASSAGE_ORDER.length
      ) {
        const key = SUIT_7_PASSAGE_ORDER[pRow.sort_order - 1];
        deDef = GERMAN_PASSAGE_TRANSLATIONS[key];
      } else if (
        pRow.exam_title === 'Paper Test Suit 8' &&
        pRow.sort_order >= 1 &&
        pRow.sort_order <= SUIT_8_PASSAGE_ORDER.length
      ) {
        const key = SUIT_8_PASSAGE_ORDER[pRow.sort_order - 1];
        deDef = GERMAN_PASSAGE_TRANSLATIONS[key];
      }
    }

    if (deDef) {
      const pItem: PassageTranslationItem = {
        id: pRow.id,
        title: deDef.deTitle,
        body_markdown: deDef.deBodyMarkdown,
      };

      if (pRow.image_url) {
        pItem.image_url = pRow.image_url;
      }

      matchedPassages.push({
        dbId: pRow.id,
        examTitle: pRow.exam_title,
        sectionTitle: pRow.section_title,
        translation: pItem,
      });

      passageTranslations.push(pItem);
    } else if (
      pRow.exam_title === 'Paper Test Suit 1' ||
      pRow.exam_title === 'Paper Test Suit 7' ||
      pRow.exam_title === 'Paper Test Suit 8' ||
      pRow.exam_title === 'Paper Test Suit 9' ||
      pRow.exam_title === 'Paper Test Suit 10' ||
      pRow.exam_title === 'Paper Test Suit 11' ||
      pRow.exam_title === 'Paper Test Suit 12'
    ) {
      console.warn(`[WARN] No German definition found for passage title: "${pRow.title}" in ${pRow.exam_title}`);
    }
  }

  // 4. Translate Sections
  const sectionTranslations: SectionTranslationItem[] = [];
  for (const s of sectionsRes.rows) {
    if (!s.question_type) continue;
    const desc = MODULE_SECTION_DESCRIPTORS[s.question_type];
    if (!desc) continue;

    let deTitle = desc.deTitle;
    const sTitle = s.title ?? '';
    if (s.question_type === 'sc_2') {
      if (sTitle.toLowerCase().includes('process')) {
        deTitle = 'Prozesse analysieren';
      } else {
        deTitle = 'Formale Darstellungen verstehen';
      }
    }

    const sItem: SectionTranslationItem = {
      id: s.id,
      title: deTitle,
    };

    if (typeof s.description === 'string' && s.description.trim() !== '' && desc.deDescription) {
      sItem.description = desc.deDescription;
    }

    sectionTranslations.push(sItem);
  }

  const payload: TranslationInputPayload = {
    lang: 'de',
    questions: questionTranslations,
    passages: passageTranslations,
    sections: sectionTranslations,
  };

  return {
    payload,
    matchedQuestions,
    matchedPassages,
    dbQuestionsMap,
    dbPassagesMap,
    dbSectionsMap,
  };
}

/**
 * Validates the translation payload against all DB rows using findTranslationIssues.
 */
export function validatePaperModulePayload(
  payload: TranslationInputPayload,
  dbQuestionsMap: Map<string, DbQuestionRow>,
  dbPassagesMap: Map<string, DbPassageRow>,
  dbSectionsMap: Map<string, DbSectionRow>,
): {
  questionIssues: Array<{ id: string; issues: string[] }>;
  passageIssues: Array<{ id: string; issues: string[] }>;
  sectionIssues: Array<{ id: string; issues: string[] }>;
} {
  const questionIssues: Array<{ id: string; issues: string[] }> = [];
  const passageIssues: Array<{ id: string; issues: string[] }> = [];
  const sectionIssues: Array<{ id: string; issues: string[] }> = [];

  if (payload.questions) {
    for (const q of payload.questions) {
      const dbRow = dbQuestionsMap.get(q.id);
      if (!dbRow) {
        questionIssues.push({ id: q.id, issues: ['Question ID not found in database'] });
        continue;
      }
      const { id, ...cleanQ } = q;
      const issues = findTranslationIssues('question', dbRow, cleanQ);
      if (issues.length > 0) {
        questionIssues.push({ id: q.id, issues });
      }
    }
  }

  if (payload.passages) {
    for (const p of payload.passages) {
      const dbRow = dbPassagesMap.get(p.id);
      if (!dbRow) {
        passageIssues.push({ id: p.id, issues: ['Passage ID not found in database'] });
        continue;
      }
      const { id, ...cleanP } = p;
      const issues = findTranslationIssues('passage', dbRow, cleanP);
      if (issues.length > 0) {
        passageIssues.push({ id: p.id, issues });
      }
    }
  }

  if (payload.sections) {
    for (const s of payload.sections) {
      const dbRow = dbSectionsMap.get(s.id);
      if (!dbRow) {
        sectionIssues.push({ id: s.id, issues: ['Section ID not found in database'] });
        continue;
      }
      const { id, ...cleanS } = s;
      const issues = findTranslationIssues('section', dbRow, cleanS);
      if (issues.length > 0) {
        sectionIssues.push({ id: s.id, issues });
      }
    }
  }

  return { questionIssues, passageIssues, sectionIssues };
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const outIdx = args.indexOf('--out');
  const outPath =
    outIdx !== -1 && args[outIdx + 1]
      ? path.resolve(args[outIdx + 1])
      : path.resolve(__dirname, '../translations/paper-module-de.json');

  const baseDir = '/Users/rzy/Desktop/ProjectWithTien/Web/testas/PAPER/PaperModule';

  console.log('Connecting to database...');
  const client = getDbClient();
  await client.connect();

  try {
    console.log(`Extracting German PaperModule translations from:\n  ${baseDir}`);
    const {
      payload,
      matchedQuestions,
      matchedPassages,
      dbQuestionsMap,
      dbPassagesMap,
      dbSectionsMap,
    } = await buildPaperModuleTranslations(client, baseDir);

    console.log(`\n=== Extraction Summary ===`);
    console.log(`Matched Questions: ${matchedQuestions.length}`);
    console.log(`Matched Passages:  ${matchedPassages.length}`);
    console.log(`Matched Sections:  ${payload.sections?.length ?? 0}`);

    // Validate payload against DB rows
    console.log(`\nValidating translations with findTranslationIssues...`);
    const { questionIssues, passageIssues, sectionIssues } = validatePaperModulePayload(
      payload,
      dbQuestionsMap,
      dbPassagesMap,
      dbSectionsMap,
    );

    if (questionIssues.length > 0 || passageIssues.length > 0 || sectionIssues.length > 0) {
      console.error(`\n[ERROR] Found translation validation issues!`);
      if (questionIssues.length > 0) {
        console.error(`Question issues (${questionIssues.length}):`);
        for (const qi of questionIssues.slice(0, 10)) {
          console.error(`  [${qi.id}] ${qi.issues.join(', ')}`);
        }
      }
      if (passageIssues.length > 0) {
        console.error(`Passage issues (${passageIssues.length}):`);
        for (const pi of passageIssues.slice(0, 10)) {
          console.error(`  [${pi.id}] ${pi.issues.join(', ')}`);
        }
      }
      if (sectionIssues.length > 0) {
        console.error(`Section issues (${sectionIssues.length}):`);
        for (const si of sectionIssues.slice(0, 10)) {
          console.error(`  [${si.id}] ${si.issues.join(', ')}`);
        }
      }
      process.exit(1);
    }

    console.log(`All translation items passed validation! (0 issues)`);

    // Write payload
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`\nTranslation payload written to: ${outPath}`);

    if (isApply) {
      console.log(`\n--apply specified. Applying translations to database...`);
      const { issues, questionUpdates, passageUpdates, sectionUpdates } = processTranslationPayload({
        payload,
        isReviewed: true,
        baseQuestions: dbQuestionsMap,
        basePassages: dbPassagesMap,
        baseSections: dbSectionsMap,
      });

      if (issues.length > 0) {
        console.error(`Validation issues encountered (${issues.length}):`);
        for (const issue of issues.slice(0, 10)) {
          console.error(`  [${issue.kind.toUpperCase()}] ${issue.id}: ${issue.issues.join(', ')}`);
        }
        process.exit(1);
      }

      await client.query('BEGIN');
      try {
        for (const q of questionUpdates) {
          await client.query(
            `UPDATE questions SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
            [JSON.stringify(q.translationWithHash), q.id],
          );
        }

        for (const p of passageUpdates) {
          await client.query(
            `UPDATE passages SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
            [JSON.stringify(p.translationWithHash), p.id],
          );
        }

        for (const s of sectionUpdates) {
          await client.query(
            `UPDATE sections SET translations = jsonb_set(COALESCE(translations, '{}'::jsonb), '{de}', $1::jsonb) WHERE id = $2`,
            [JSON.stringify(s.translationWithHash), s.id],
          );
        }

        await client.query('COMMIT');
        console.log(`\nDatabase update complete:`);
        console.log(`  Updated questions: ${questionUpdates.length}`);
        console.log(`  Updated passages:  ${passageUpdates.length}`);
        console.log(`  Updated sections:  ${sectionUpdates.length}`);
      } catch (applyErr) {
        await client.query('ROLLBACK');
        throw applyErr;
      }

      // Query section_de_gaps to verify remaining gaps
      const gapsRes = await client.query<{
        section_id: string;
        exam_title: string;
        section_title: string;
        question_type: string;
        missing_de: number;
      }>(`
        SELECT s.id as section_id, e.title as exam_title, s.title as section_title, s.question_type, g.missing_de
        FROM public.section_de_gaps g
        JOIN public.sections s ON g.section_id = s.id
        JOIN public.exams e ON s.exam_id = e.id
        WHERE e.format = 'Paper' AND g.missing_de > 0
        ORDER BY s.question_type, e.title
      `);

      console.log(`\nRemaining Paper section gaps in public.section_de_gaps: ${gapsRes.rows.length}`);
      if (gapsRes.rows.length > 0) {
        for (const gap of gapsRes.rows) {
          console.log(`  [${gap.exam_title} / ${gap.question_type}] Missing: ${gap.missing_de}`);
        }
      } else {
        console.log(`🎉 ALL Paper sections have 0 gaps! German is fully unlocked!`);
      }
    } else {
      console.log(`\nDry run complete. Use --apply to execute updates on the database.`);
    }
  } catch (error) {
    console.error('Execution failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}
