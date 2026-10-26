import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCourseDto } from '../../../src/modules/courses/application/dtos/create-course.dto';
import { UpdateCourseDto } from '../../../src/modules/courses/application/dtos/update-course.dto';
import { CourseResponseDto } from '../../../src/modules/courses/application/dtos/course-response.dto';
import { Course } from '../../../src/modules/courses/domain/entities/course.entity';
// [Test contenido del curso · 2026-10-24]: `content` (Markdown) sin límite de longitud y separado de la descripción | [Patrón]: Unit Test (DTO + Mapper)

const LONG = '# Temario\n\n' + 'Lección con mucho texto. '.repeat(20_000); // ~500 000 caracteres

describe('Course content (Markdown sin límite)', () => {
  it('UpdateCourseDto acepta contenido muy largo (sin @MaxLength) y rechaza tipos no string', async () => {
    expect(
      await validate(plainToInstance(UpdateCourseDto, { content: LONG })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(UpdateCourseDto, { content: null })),
    ).toHaveLength(0);
    const errors = await validate(
      plainToInstance(UpdateCourseDto, { content: 42 }),
    );
    expect(errors.map((e) => e.property)).toEqual(['content']);
  });

  it('CreateCourseDto mantiene el tope de shortDescription (resumen) pero no el de content', async () => {
    const dto = plainToInstance(CreateCourseDto, {
      title: 'Inglés A1',
      slug: 'ingles-a1',
      shortDescription: 'x'.repeat(501),
      content: LONG,
      category: 'A1',
      group: 'EN',
      instructor: 'Equipo',
    });
    const props = (await validate(dto)).map((e) => e.property);
    expect(props).toEqual(['shortDescription']);
  });

  it('CourseResponseDto expone content y devuelve null cuando la columna no se seleccionó (listados)', () => {
    const base = {
      id: 'c1',
      title: 'Inglés A1',
      slug: 'ingles-a1',
      shortDescription: 'Resumen',
      description: 'Resumen',
      category: 'A1',
      group: 'EN',
      instructor: 'Equipo',
      instructorTitle: null,
      color: '#000000',
      icon: 'EN',
      tags: [],
      eje: 1,
      lab: null,
      price: 0,
      originalPrice: null,
      currency: 'USD',
      durationHours: 1,
      level: 'A1',
      rating: 0,
      studentsCount: 0,
      modality: 'Online',
      isProBono: false,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Course;
    expect(
      CourseResponseDto.fromDomain({ ...base, content: LONG } as Course, null)
        .content,
    ).toBe(LONG);
    expect(CourseResponseDto.fromDomain(base, null).content).toBeNull();
  });
});
