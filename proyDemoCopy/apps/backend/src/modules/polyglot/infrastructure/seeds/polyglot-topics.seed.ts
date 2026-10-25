import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { slugify } from '../../../../shared/application/topic-crud.service';
import { PolyglotConcept } from '../../domain/entities/polyglot-concept.entity';
import { PolyglotTerm } from '../../domain/entities/polyglot-term.entity';
import {
  PolyglotTopic,
  type PolyglotCategory,
} from '../../domain/entities/polyglot-topic.entity';
import type { ConceptKind } from '../../domain/entities/polyglot-concept.entity';
import { needsNativeReview } from '../../domain/language-order';
// [Seed PolyglotTopics · Sprints 10.5/10.15 · RF-129/RF-130]: cinco temas semilla — familia, animales, comida, viajes y cultura — con vocabulario básico en los siete idiomas y emoji Unicode (sin licencia de imagen) | [Patrón]: Idempotent Seed (`OnModuleInit`: inserta solo los temas que faltan) | [Principio]: contenido original (CC BY 4.0, © Aula de Idiomas) + verificación humana (términos sin revisar; el IPA se obtiene con «Obtener IPA») | [Paradigma]: Declarativo

const ORDER = ['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es'] as const;

// [Formato]: «emoji | glosa | en | de | fr | pt | ru | zh | es» → una línea por concepto (fácil de revisar por un docente nativo)
// [2026-10-19]: `category` agrupa los temas en la UI (select por categoría) · `kind` = palabra o frase (por defecto vocabulario de palabras)
// [Nuevos temas]: colores, días de la semana, saludos, despedidas, agradecer y pedir, en el médico, en el trabajo (frases), números y pronombres (gramática)
type SeedTopic = { emoji: string; rows: string[]; category?: PolyglotCategory; kind?: ConceptKind };
const SEED: Record<string, SeedTopic> = {
  Familia: {
    emoji: '👨‍👩‍👧',
    rows: [
      '👩 | madre | mother | Mutter | mère | mãe | мать | 母亲 | madre',
      '👨 | padre | father | Vater | père | pai | отец | 父亲 | padre',
      '👧 | hermana | sister | Schwester | sœur | irmã | сестра | 姐妹 | hermana',
      '👦 | hermano | brother | Bruder | frère | irmão | брат | 兄弟 | hermano',
      '👵 | abuela | grandmother | Großmutter | grand-mère | avó | бабушка | 祖母 | abuela',
      '👴 | abuelo | grandfather | Großvater | grand-père | avô | дедушка | 祖父 | abuelo',
      '👶 | hijo | son | Sohn | fils | filho | сын | 儿子 | hijo',
      '👧 | hija | daughter | Tochter | fille | filha | дочь | 女儿 | hija',
    ],
  },
  Animales: {
    emoji: '🐾',
    rows: [
      '🐕 | perro | dog | Hund | chien | cão | собака | 狗 | perro',
      '🐈 | gato | cat | Katze | chat | gato | кошка | 猫 | gato',
      '🐎 | caballo | horse | Pferd | cheval | cavalo | лошадь | 马 | caballo',
      '🐦 | pájaro | bird | Vogel | oiseau | pássaro | птица | 鸟 | pájaro',
      '🐟 | pez | fish | Fisch | poisson | peixe | рыба | 鱼 | pez',
      '🐄 | vaca | cow | Kuh | vache | vaca | корова | 奶牛 | vaca',
    ],
  },
  Comida: {
    emoji: '🍽️',
    rows: [
      '🍞 | pan | bread | Brot | pain | pão | хлеб | 面包 | pan',
      '💧 | agua | water | Wasser | eau | água | вода | 水 | agua',
      '🍎 | manzana | apple | Apfel | pomme | maçã | яблоко | 苹果 | manzana',
      '🧀 | queso | cheese | Käse | fromage | queijo | сыр | 奶酪 | queso',
      '🥛 | leche | milk | Milch | lait | leite | молоко | 牛奶 | leche',
      '🥚 | huevo | egg | Ei | œuf | ovo | яйцо | 鸡蛋 | huevo',
    ],
  },
  Viajes: {
    emoji: '✈️',
    rows: [
      '🛫 | aeropuerto | airport | Flughafen | aéroport | aeroporto | аэропорт | 机场 | aeropuerto',
      '🚆 | tren | train | Zug | train | trem | поезд | 火车 | tren',
      '🎫 | billete | ticket | Fahrkarte | billet | bilhete | билет | 票 | billete',
      '🏨 | hotel | hotel | Hotel | hôtel | hotel | гостиница | 酒店 | hotel',
      '🛂 | pasaporte | passport | Reisepass | passeport | passaporte | паспорт | 护照 | pasaporte',
      '🗺️ | mapa | map | Karte | carte | mapa | карта | 地图 | mapa',
    ],
  },
  Cultura: {
    emoji: '🎭',
    rows: [
      '🎵 | música | music | Musik | musique | música | музыка | 音乐 | música',
      '📖 | libro | book | Buch | livre | livro | книга | 书 | libro',
      '🏛️ | museo | museum | Museum | musée | museu | музей | 博物馆 | museo',
      '🎉 | fiesta (festividad) | festival | Fest | fête | festa | праздник | 节日 | fiesta',
      '💃 | baile | dance | Tanz | danse | dança | танец | 舞蹈 | baile',
      '🖼️ | pintura (cuadro) | painting | Gemälde | peinture | pintura | картина | 绘画 | pintura',
    ],
  },
  Colores: {
    emoji: '🎨',
    rows: [
      '🔴 | rojo | red | rot | rouge | vermelho | красный | 红色 | rojo',
      '🔵 | azul | blue | blau | bleu | azul | синий | 蓝色 | azul',
      '🟢 | verde | green | grün | vert | verde | зелёный | 绿色 | verde',
      '🟡 | amarillo | yellow | gelb | jaune | amarelo | жёлтый | 黄色 | amarillo',
      '⚫ | negro | black | schwarz | noir | preto | чёрный | 黑色 | negro',
      '⚪ | blanco | white | weiß | blanc | branco | белый | 白色 | blanco',
    ],
  },
  'Días de la semana': {
    emoji: '📅',
    rows: [
      '1️⃣ | lunes | Monday | Montag | lundi | segunda-feira | понедельник | 星期一 | lunes',
      '2️⃣ | martes | Tuesday | Dienstag | mardi | terça-feira | вторник | 星期二 | martes',
      '3️⃣ | miércoles | Wednesday | Mittwoch | mercredi | quarta-feira | среда | 星期三 | miércoles',
      '4️⃣ | jueves | Thursday | Donnerstag | jeudi | quinta-feira | четверг | 星期四 | jueves',
      '5️⃣ | viernes | Friday | Freitag | vendredi | sexta-feira | пятница | 星期五 | viernes',
      '6️⃣ | sábado | Saturday | Samstag | samedi | sábado | суббота | 星期六 | sábado',
      '7️⃣ | domingo | Sunday | Sonntag | dimanche | domingo | воскресенье | 星期日 | domingo',
    ],
  },
  Saludos: {
    emoji: '👋',
    category: 'phrases',
    kind: 'phrase',
    rows: [
      '👋 | hola | Hello | Hallo | Salut | Olá | Привет | 你好 | Hola',
      '☀️ | buenos días | Good morning | Guten Morgen | Bonjour | Bom dia | Доброе утро | 早上好 | Buenos días',
      '🌇 | buenas tardes | Good afternoon | Guten Tag | Bon après-midi | Boa tarde | Добрый день | 下午好 | Buenas tardes',
      '🌆 | buenas noches (al llegar) | Good evening | Guten Abend | Bonsoir | Boa noite | Добрый вечер | 晚上好 | Buenas noches',
      '🙂 | ¿cómo estás? | How are you? | Wie geht es dir? | Comment ça va ? | Como você está? | Как дела? | 你好吗？ | ¿Cómo estás?',
      '🤝 | mucho gusto | Nice to meet you | Freut mich | Enchanté | Muito prazer | Очень приятно | 很高兴认识你 | Mucho gusto',
    ],
  },
  Despedidas: {
    emoji: '🚪',
    category: 'phrases',
    kind: 'phrase',
    rows: [
      '👋 | adiós | Goodbye | Auf Wiedersehen | Au revoir | Adeus | До свидания | 再见 | Adiós',
      '⏳ | hasta luego | See you later | Bis später | À plus tard | Até logo | До встречи | 回头见 | Hasta luego',
      '📆 | hasta mañana | See you tomorrow | Bis morgen | À demain | Até amanhã | До завтра | 明天见 | Hasta mañana',
      '🌙 | buenas noches (al irse) | Good night | Gute Nacht | Bonne nuit | Boa noite | Спокойной ночи | 晚安 | Buenas noches',
      '🍀 | cuídate | Take care | Mach’s gut | Prends soin de toi | Cuide-se | Береги себя | 保重 | Cuídate',
    ],
  },
  'Agradecer y pedir': {
    emoji: '🙏',
    category: 'phrases',
    kind: 'phrase',
    rows: [
      '🙏 | gracias | Thank you | Danke | Merci | Obrigado | Спасибо | 谢谢 | Gracias',
      '💜 | muchas gracias | Thank you very much | Vielen Dank | Merci beaucoup | Muito obrigado | Большое спасибо | 非常感谢 | Muchas gracias',
      '😊 | de nada | You’re welcome | Gern geschehen | De rien | De nada | Не за что | 不客气 | De nada',
      '🙋 | por favor | Please | Bitte | S’il vous plaît | Por favor | Пожалуйста | 请 | Por favor',
      '😔 | lo siento | I’m sorry | Es tut mir leid | Je suis désolé | Desculpe | Извините | 对不起 | Lo siento',
      '✋ | disculpe (para llamar la atención) | Excuse me | Entschuldigung | Excusez-moi | Com licença | Простите | 打扰一下 | Disculpe',
    ],
  },
  'En el médico': {
    emoji: '🩺',
    category: 'phrases',
    kind: 'phrase',
    rows: [
      '🤒 | me siento mal | I feel sick | Mir geht es schlecht | Je me sens mal | Estou me sentindo mal | Мне плохо | 我不舒服 | Me siento mal',
      '🤕 | me duele la cabeza | I have a headache | Ich habe Kopfschmerzen | J’ai mal à la tête | Estou com dor de cabeça | У меня болит голова | 我头疼 | Me duele la cabeza',
      '🌡️ | tengo fiebre | I have a fever | Ich habe Fieber | J’ai de la fièvre | Estou com febre | У меня температура | 我发烧了 | Tengo fiebre',
      '📋 | necesito una cita | I need an appointment | Ich brauche einen Termin | J’ai besoin d’un rendez-vous | Preciso de uma consulta | Мне нужно записаться к врачу | 我需要预约 | Necesito una cita',
      '💊 | ¿cada cuánto tomo el medicamento? | How often should I take the medicine? | Wie oft soll ich das Medikament nehmen? | À quelle fréquence dois-je prendre le médicament ? | Com que frequência devo tomar o remédio? | Как часто принимать лекарство? | 这个药多久吃一次？ | ¿Cada cuánto tomo el medicamento?',
      '⚠️ | soy alérgico a la penicilina | I’m allergic to penicillin | Ich bin allergisch gegen Penicillin | Je suis allergique à la pénicilline | Sou alérgico à penicilina | У меня аллергия на пенициллин | 我对青霉素过敏 | Soy alérgico a la penicilina',
    ],
  },
  'En el trabajo': {
    emoji: '💼',
    category: 'phrases',
    kind: 'phrase',
    rows: [
      '🗓️ | tengo una reunión | I have a meeting | Ich habe eine Besprechung | J’ai une réunion | Tenho uma reunião | У меня совещание | 我有一个会议 | Tengo una reunión',
      '📧 | te envío el correo | I’ll send you the email | Ich schicke dir die E-Mail | Je t’envoie l’e-mail | Vou te enviar o e-mail | Я пришлю тебе письмо | 我把邮件发给你 | Te envío el correo',
      '⏰ | ¿a qué hora empieza? | What time does it start? | Wann fängt es an? | À quelle heure ça commence ? | A que horas começa? | Во сколько начинается? | 几点开始？ | ¿A qué hora empieza?',
      '🤝 | ¿me puedes ayudar? | Can you help me? | Kannst du mir helfen? | Tu peux m’aider ? | Você pode me ajudar? | Ты можешь мне помочь? | 你能帮我吗？ | ¿Me puedes ayudar?',
      '✅ | ya terminé | I’ve finished | Ich bin fertig | J’ai fini | Já terminei | Я закончил | 我做完了 | Ya terminé',
    ],
  },
  'Números del 1 al 10': {
    emoji: '🔢',
    category: 'numbers',
    rows: [
      '1️⃣ | uno | one | eins | un | um | один | 一 | uno',
      '2️⃣ | dos | two | zwei | deux | dois | два | 二 | dos',
      '3️⃣ | tres | three | drei | trois | três | три | 三 | tres',
      '4️⃣ | cuatro | four | vier | quatre | quatro | четыре | 四 | cuatro',
      '5️⃣ | cinco | five | fünf | cinq | cinco | пять | 五 | cinco',
      '6️⃣ | seis | six | sechs | six | seis | шесть | 六 | seis',
      '7️⃣ | siete | seven | sieben | sept | sete | семь | 七 | siete',
      '8️⃣ | ocho | eight | acht | huit | oito | восемь | 八 | ocho',
      '9️⃣ | nueve | nine | neun | neuf | nove | девять | 九 | nueve',
      '🔟 | diez | ten | zehn | dix | dez | десять | 十 | diez',
    ],
  },
  'Pronombres personales': {
    emoji: '🧑‍🤝‍🧑',
    category: 'grammar',
    rows: [
      '🙋 | yo | I | ich | je | eu | я | 我 | yo',
      '👉 | tú | you | du | tu | você | ты | 你 | tú',
      '👨 | él | he | er | il | ele | он | 他 | él',
      '👩 | ella | she | sie | elle | ela | она | 她 | ella',
      '👥 | nosotros | we | wir | nous | nós | мы | 我们 | nosotros',
      '🧑‍🤝‍🧑 | ellos | they | sie | ils | eles | они | 他们 | ellos',
    ],
  },
};

// [parseRow]: línea → concepto + términos por idioma | Función pura (testeable sin BD)
export function parseRow(row: string): {
  emoji: string;
  gloss: string;
  terms: Record<string, string>;
} {
  const [emoji, gloss, ...texts] = row.split('|').map((s) => s.trim());
  return {
    emoji,
    gloss,
    terms: Object.fromEntries(ORDER.map((lang, i) => [lang, texts[i]])),
  };
}

export const POLYGLOT_SEED = SEED;

@Injectable()
export class PolyglotTopicSeeder implements OnModuleInit {
  private readonly logger = new Logger(PolyglotTopicSeeder.name);

  constructor(
    @InjectRepository(PolyglotTopic)
    private readonly topics: Repository<PolyglotTopic>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const titles = Object.keys(SEED);
      const existing = new Set(
        (
          await this.topics.find({
            where: { slug: In(titles.map(slugify)) },
            select: { slug: true },
          })
        ).map((t) => t.slug),
      );
      const missing = titles.filter((t) => !existing.has(slugify(t)));
      for (const title of missing) {
        // `transaction` (TypeORM): un tema entra completo o no entra
        await this.topics.manager.transaction(async (tx) => {
          const topic = await tx.save(
            tx.create(PolyglotTopic, {
              slug: slugify(title),
              title,
              emoji: SEED[title].emoji,
              description: '',
              language: null,
              levels: ['A1', 'A2'],
              category: SEED[title].category ?? 'vocabulary',
              status: 'published', // Vocabulario básico propio; los términos siguen «sin revisar» hasta la revisión nativa
              createdBy: null,
              archivedAt: null,
            }),
          );
          for (const [position, row] of SEED[title].rows.entries()) {
            const p = parseRow(row);
            const concept = await tx.save(
              tx.create(PolyglotConcept, {
                topicId: topic.id,
                position,
                kind: SEED[title].kind ?? 'word',
                emoji: p.emoji,
                gloss: p.gloss,
                imageUrl: null,
                imageLicense: null,
              }),
            );
            await tx.save(
              Object.entries(p.terms).map(([language, text]) =>
                tx.create(PolyglotTerm, {
                  conceptId: concept.id,
                  language,
                  text,
                  ipa: '',
                  ipaUs: null,
                  reviewed: false,
                  needsNativeReview: needsNativeReview(language),
                }),
              ),
            );
          }
        });
      }
      if (missing.length)
        this.logger.log(`Temas poliglota sembrados: ${missing.length}`);
    } catch (err) {
      // Sin tabla aún (migración pendiente) → no tumba el arranque
      this.logger.warn(
        `Seed poliglota omitido: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
