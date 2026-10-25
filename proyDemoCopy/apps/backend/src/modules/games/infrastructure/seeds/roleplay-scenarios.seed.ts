import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RolePlayScenario } from '../../domain/entities/roleplay-scenario.entity';
// [Seed RolePlayScenarios · Sprints 8.5/8.17 · RF-101]: seis escenarios propios (restaurante, entrevista de trabajo, aeropuerto, médico, hotel y reunión) | [Patrón]: Idempotent Seed (`OnModuleInit`: inserta solo los slugs que faltan) | [Principio]: SSOT + contenido original (CC BY 4.0, © Aula de Idiomas) | [Paradigma]: Declarativo

const obj = (id: string, text: string, ...keywords: string[]) => ({
  id,
  text,
  keywords,
});

// `export function` pura: mismo resultado siempre (testeable sin BD)
export function buildRolePlayScenarioSeed(): Partial<RolePlayScenario>[] {
  return [
    {
      slug: 'en-restaurant',
      title: 'En el restaurante',
      emoji: '🍽️',
      language: 'en',
      level: 'A2',
      role: 'a friendly waiter at a small restaurant',
      opening: 'Good evening! Table for one? Here is the menu.',
      objectives: [
        obj('greet', 'Saluda y pide mesa', 'hello', 'good evening', 'table'),
        obj(
          'order',
          'Pide un plato y una bebida',
          "i'd like",
          'i would like',
          'can i have',
        ),
        obj('bill', 'Pide la cuenta', 'bill', 'check'),
      ],
      vocabulary: ['menu', 'starter', 'main course', 'dessert', 'bill', 'tip'],
    },
    {
      slug: 'en-job-interview',
      title: 'Entrevista de trabajo',
      emoji: '💼',
      language: 'en',
      level: 'B1',
      role: 'an HR interviewer at a tech company',
      opening: 'Thanks for coming. Could you tell me a little about yourself?',
      objectives: [
        obj('intro', 'Preséntate', 'my name is', "i'm", 'i am'),
        obj(
          'experience',
          'Describe tu experiencia',
          'experience',
          'worked',
          'years',
        ),
        obj(
          'question',
          'Haz una pregunta sobre el puesto',
          'team',
          'salary',
          'responsibilities',
        ),
      ],
      vocabulary: [
        'experience',
        'skills',
        'strengths',
        'teamwork',
        'deadline',
        'salary',
      ],
    },
    {
      slug: 'en-airport',
      title: 'En el aeropuerto',
      emoji: '🛫',
      language: 'en',
      level: 'A2',
      role: 'an airline check-in agent',
      opening: 'Hello! Can I see your passport and booking, please?',
      objectives: [
        obj('documents', 'Entrega tus documentos', 'passport', 'here you are'),
        obj(
          'luggage',
          'Pregunta por el equipaje',
          'luggage',
          'bag',
          'suitcase',
        ),
        obj('seat', 'Pide un asiento', 'window', 'aisle', 'seat'),
      ],
      vocabulary: [
        'passport',
        'boarding pass',
        'gate',
        'luggage',
        'aisle',
        'window seat',
      ],
    },
    {
      slug: 'en-doctor',
      title: 'En el médico',
      emoji: '🩺',
      language: 'en',
      level: 'B1',
      role: 'a general practitioner (doctor)',
      opening: 'Hello, please take a seat. What seems to be the problem?',
      objectives: [
        obj(
          'symptoms',
          'Describe tus síntomas',
          'headache',
          'fever',
          'pain',
          'cough',
        ),
        obj('since', 'Di desde cuándo', 'since', 'for', 'days'),
        obj(
          'advice',
          'Pregunta qué debes hacer',
          'should i',
          'medicine',
          'what can i',
        ),
      ],
      vocabulary: [
        'symptom',
        'fever',
        'headache',
        'prescription',
        'appointment',
        'allergy',
      ],
    },
    {
      slug: 'en-hotel',
      title: 'En el hotel',
      emoji: '🏨',
      language: 'en',
      level: 'A2',
      role: 'a hotel receptionist',
      opening: 'Welcome to the Riverside Hotel. Do you have a reservation?',
      objectives: [
        obj('checkin', 'Haz el check-in', 'reservation', 'booking', 'check in'),
        obj('breakfast', 'Pregunta por el desayuno', 'breakfast'),
        obj('wifi', 'Pide la contraseña del wifi', 'wifi', 'password'),
      ],
      vocabulary: [
        'reservation',
        'single room',
        'double room',
        'key card',
        'breakfast',
        'checkout',
      ],
    },
    {
      slug: 'en-meeting',
      title: 'Reunión de trabajo',
      emoji: '📊',
      language: 'en',
      level: 'B2',
      role: 'a project manager running a weekly meeting',
      opening: "Let's get started. How is your part of the project going?",
      objectives: [
        obj('update', 'Informa del avance', 'finished', 'progress', 'on track'),
        obj('problem', 'Explica un problema', 'problem', 'issue', 'delay'),
        obj('propose', 'Propón una solución', 'suggest', 'propose', 'we could'),
      ],
      vocabulary: [
        'deadline',
        'agenda',
        'progress',
        'issue',
        'proposal',
        'follow up',
      ],
    },
  ];
}

@Injectable()
export class RolePlayScenarioSeeder implements OnModuleInit {
  private readonly logger = new Logger(RolePlayScenarioSeeder.name);

  constructor(
    @InjectRepository(RolePlayScenario)
    private readonly scenarios: Repository<RolePlayScenario>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const seed = buildRolePlayScenarioSeed();
      const existing = new Set(
        (
          await this.scenarios.find({
            where: { slug: In(seed.map((s) => s.slug!)) },
            select: { slug: true },
          })
        ).map((s) => s.slug),
      );
      const missing = seed.filter((s) => !existing.has(s.slug!));
      if (missing.length) {
        await this.scenarios.save(missing.map((s) => this.scenarios.create(s)));
        this.logger.log(`Escenarios de role-play sembrados: ${missing.length}`);
      }
    } catch (err) {
      // Sin tabla aún (migración pendiente) → no tumba el arranque
      this.logger.warn(
        `Seed de escenarios omitido: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
