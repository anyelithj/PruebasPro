import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DialogueTopic } from '../../domain/entities/dialogue-topic.entity';
// [Seed DialogueTopics · Sprints 9.3/9.15 · RF-121]: ocho temas semilla para los siete idiomas — presentarse, hobbies, rutinas, familia, animales, comida, viajes y cultura — con objetivos y vocabulario clave | [Patrón]: Idempotent Seed (`OnModuleInit`: inserta solo los slugs que faltan) | [Principio]: SSOT (los slugs coinciden con las aperturas de FastAPI topic_script.py) + contenido original (CC BY 4.0, © Aula de Idiomas) | [Paradigma]: Declarativo

type Vocab = Record<'en' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ru', string[]>;
const topic = (
  slug: string,
  title: string,
  emoji: string,
  levels: string[],
  objectives: string[],
  vocabulary: Vocab,
): Partial<DialogueTopic> => ({
  slug,
  title,
  emoji,
  levels,
  objectives,
  vocabulary,
  language: null,
  description: '',
  opening: null,
  createdBy: null,
  archivedAt: null,
});

// `export function` pura: mismo resultado siempre (testeable sin BD)
export function buildDialogueTopicSeed(): Partial<DialogueTopic>[] {
  return [
    topic(
      'introductions',
      'Presentarse',
      '👋',
      ['A1', 'A2'],
      ['Di tu nombre', 'Di de dónde eres', 'Pregunta algo a tu compañero'],
      {
        en: ['name', 'from', 'live', 'nice to meet you', 'years old'],
        es: ['nombre', 'soy de', 'vivo', 'encantado', 'años'],
        fr: ['nom', "je m'appelle", 'habite', 'enchanté', 'ans'],
        de: ['Name', 'komme aus', 'wohne', 'freut mich', 'Jahre alt'],
        pt: ['nome', 'sou de', 'moro', 'prazer', 'anos'],
        zh: ['名字', '我叫', '来自', '住在', '认识你很高兴'],
        ru: ['зовут', 'из', 'живу', 'приятно', 'лет'],
      },
    ),
    topic(
      'hobbies',
      'Hobbies y tiempo libre',
      '🎨',
      ['A1', 'A2', 'B1'],
      ['Cuenta qué te gusta hacer', 'Di con qué frecuencia lo haces'],
      {
        en: ['like', 'play', 'music', 'read', 'weekend', 'often'],
        es: [
          'me gusta',
          'jugar',
          'música',
          'leer',
          'fin de semana',
          'a menudo',
        ],
        fr: ["j'aime", 'jouer', 'musique', 'lire', 'week-end', 'souvent'],
        de: ['gern', 'spielen', 'Musik', 'lesen', 'Wochenende', 'oft'],
        pt: [
          'gosto',
          'jogar',
          'música',
          'ler',
          'fim de semana',
          'muitas vezes',
        ],
        zh: ['喜欢', '音乐', '看书', '周末', '经常'],
        ru: ['люблю', 'играть', 'музыка', 'читать', 'выходные', 'часто'],
      },
    ),
    topic(
      'routines',
      'Rutinas diarias',
      '⏰',
      ['A1', 'A2'],
      ['Describe tu mañana', 'Usa la hora'],
      {
        en: ['get up', 'breakfast', 'work', 'usually', "o'clock", 'go to bed'],
        es: [
          'me levanto',
          'desayuno',
          'trabajo',
          'normalmente',
          'a las',
          'me acuesto',
        ],
        fr: [
          'je me lève',
          'petit-déjeuner',
          'travail',
          "d'habitude",
          'heures',
          'je me couche',
        ],
        de: [
          'stehe auf',
          'Frühstück',
          'Arbeit',
          'normalerweise',
          'Uhr',
          'ins Bett',
        ],
        pt: [
          'acordo',
          'café da manhã',
          'trabalho',
          'normalmente',
          'horas',
          'deito',
        ],
        zh: ['起床', '早饭', '工作', '一般', '点', '睡觉'],
        ru: ['встаю', 'завтрак', 'работа', 'обычно', 'часов', 'ложусь'],
      },
    ),
    topic(
      'family',
      'La familia',
      '👨‍👩‍👧',
      ['A1', 'A2', 'B1'],
      ['Presenta a tu familia', 'Describe a una persona'],
      {
        en: ['mother', 'father', 'brother', 'sister', 'children', 'older'],
        es: ['madre', 'padre', 'hermano', 'hermana', 'hijos', 'mayor'],
        fr: ['mère', 'père', 'frère', 'sœur', 'enfants', 'aîné'],
        de: ['Mutter', 'Vater', 'Bruder', 'Schwester', 'Kinder', 'älter'],
        pt: ['mãe', 'pai', 'irmão', 'irmã', 'filhos', 'mais velho'],
        zh: ['妈妈', '爸爸', '哥哥', '姐姐', '孩子'],
        ru: ['мама', 'папа', 'брат', 'сестра', 'дети', 'старший'],
      },
    ),
    topic(
      'animals',
      'Animales y mascotas',
      '🐾',
      ['A1', 'A2'],
      ['Habla de una mascota o tu animal favorito', 'Descríbelo'],
      {
        en: ['dog', 'cat', 'pet', 'favourite', 'big', 'small'],
        es: ['perro', 'gato', 'mascota', 'favorito', 'grande', 'pequeño'],
        fr: ['chien', 'chat', 'animal', 'préféré', 'grand', 'petit'],
        de: ['Hund', 'Katze', 'Haustier', 'Lieblingstier', 'groß', 'klein'],
        pt: [
          'cachorro',
          'gato',
          'animal de estimação',
          'favorito',
          'grande',
          'pequeno',
        ],
        zh: ['狗', '猫', '宠物', '最喜欢', '大', '小'],
        ru: ['собака', 'кошка', 'питомец', 'любимое', 'большой', 'маленький'],
      },
    ),
    topic(
      'food',
      'Comida',
      '🍝',
      ['A1', 'A2', 'B1'],
      ['Di tu comida favorita', 'Explica por qué te gusta'],
      {
        en: [
          'favourite',
          'delicious',
          'cook',
          'spicy',
          'vegetables',
          'dessert',
        ],
        es: ['favorita', 'rico', 'cocinar', 'picante', 'verduras', 'postre'],
        fr: ['préféré', 'délicieux', 'cuisiner', 'épicé', 'légumes', 'dessert'],
        de: [
          'Lieblingsessen',
          'lecker',
          'kochen',
          'scharf',
          'Gemüse',
          'Nachtisch',
        ],
        pt: [
          'favorita',
          'gostoso',
          'cozinhar',
          'picante',
          'legumes',
          'sobremesa',
        ],
        zh: ['好吃', '做饭', '辣', '蔬菜', '甜点'],
        ru: ['любимое', 'вкусно', 'готовить', 'острое', 'овощи', 'десерт'],
      },
    ),
    topic(
      'travel',
      'Viajes',
      '✈️',
      ['A2', 'B1', 'B2'],
      ['Cuenta un viaje en pasado', 'Recomienda un lugar'],
      {
        en: ['trip', 'visited', 'hotel', 'beach', 'flight', 'recommend'],
        es: ['viaje', 'visité', 'hotel', 'playa', 'vuelo', 'recomiendo'],
        fr: ['voyage', 'visité', 'hôtel', 'plage', 'vol', 'recommande'],
        de: ['Reise', 'besucht', 'Hotel', 'Strand', 'Flug', 'empfehle'],
        pt: ['viagem', 'visitei', 'hotel', 'praia', 'voo', 'recomendo'],
        zh: ['旅行', '去过', '酒店', '海边', '飞机', '推荐'],
        ru: ['поездка', 'был', 'гостиница', 'пляж', 'рейс', 'советую'],
      },
    ),
    topic(
      'culture',
      'Cultura y tradiciones',
      '🎭',
      ['B1', 'B2', 'C1'],
      ['Explica una tradición de tu país', 'Compárala con otra cultura'],
      {
        en: [
          'tradition',
          'festival',
          'celebrate',
          'custom',
          'history',
          'similar',
        ],
        es: [
          'tradición',
          'fiesta',
          'celebrar',
          'costumbre',
          'historia',
          'parecido',
        ],
        fr: [
          'tradition',
          'fête',
          'célébrer',
          'coutume',
          'histoire',
          'semblable',
        ],
        de: ['Tradition', 'Fest', 'feiern', 'Brauch', 'Geschichte', 'ähnlich'],
        pt: [
          'tradição',
          'festa',
          'comemorar',
          'costume',
          'história',
          'parecido',
        ],
        zh: ['传统', '节日', '庆祝', '习俗', '历史'],
        ru: ['традиция', 'праздник', 'отмечать', 'обычай', 'история', 'похоже'],
      },
    ),
  ];
}

@Injectable()
export class DialogueTopicSeeder implements OnModuleInit {
  private readonly logger = new Logger(DialogueTopicSeeder.name);

  constructor(
    @InjectRepository(DialogueTopic)
    private readonly topics: Repository<DialogueTopic>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const seed = buildDialogueTopicSeed();
      const existing = new Set(
        (
          await this.topics.find({
            where: { slug: In(seed.map((s) => s.slug!)) },
            select: { slug: true },
          })
        ).map((t) => t.slug),
      );
      const missing = seed.filter((s) => !existing.has(s.slug!));
      if (missing.length) {
        await this.topics.save(missing.map((s) => this.topics.create(s)));
        this.logger.log(`Temas de diálogo sembrados: ${missing.length}`);
      }
    } catch (err) {
      // Sin tabla aún (migración pendiente) → no tumba el arranque
      this.logger.warn(
        `Seed de temas omitido: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
