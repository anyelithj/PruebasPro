// [Test CourseSyllabus · 2026-10-25]: temario = subtemas · bloqueado sin iniciar el curso · «Marcar como estudiado» llama a la Server Action
import { fireEvent, render, screen } from "@testing-library/react";
import { CourseSyllabus } from "@/components/courses/CourseSyllabus";

const action = jest.fn(async () => ({ ok: true as const, data: { completedTopics: ["To be"], progress: 50 } }));
jest.mock("@/lib/purchase-actions", () => ({ completeTopicAction: (...a: unknown[]) => action(...(a as [])) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

const MD = "## To be\n\n**Uso**\n\n- I am\n\n## Presente simple\n\nI work.";

it("bloqueado: solo títulos, sin explicación ni botones", () => {
  render(<CourseSyllabus courseId="c1" content={MD} completed={[]} locked canTrack={false} color="#000" />);
  expect(screen.getByText(/Inicia el curso/)).toBeInTheDocument();
  expect(screen.queryByText("I am")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("inscrito: marca un subtema como estudiado", () => {
  render(<CourseSyllabus courseId="c1" content={MD} completed={[]} locked={false} canTrack color="#000" />);
  expect(screen.getByText("0 de 2 subtemas estudiados")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /Marcar como estudiado/ })[0]!);
  expect(action).toHaveBeenCalledWith("c1", "To be", true);
  expect(screen.getByText("1 de 2 subtemas estudiados")).toBeInTheDocument();
});
