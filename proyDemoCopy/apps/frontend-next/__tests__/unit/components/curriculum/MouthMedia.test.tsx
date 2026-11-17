// [Test MouthMedia · 2026-11-14]: «Cómo se pronuncia» con imagen o video de la boca — vista (img/video según la clave), subida al BFF,
// límite de tamaño y «Quitar» | [Patrón]: Test Double (fetch simulado) | [Tecnología]: Jest + React Testing Library
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MouthMedia, mouthMediaKind } from "@/components/curriculum/MouthMedia";
import { MouthMediaField } from "@/components/curriculum/MouthMediaField";

const KEY_VIDEO = "video-mp4-0b6e0a9c-4f3a-4d2e-9a51-6c1f6f0f4a11";
const KEY_IMAGE = "image-jpeg-0b6e0a9c-4f3a-4d2e-9a51-6c1f6f0f4a11";

it("la clave decide: video con controles en bucle y sin sonido; imagen con texto alternativo", () => {
  const { container, rerender } = render(<MouthMedia mediaKey={KEY_VIDEO} />);
  const video = container.querySelector("video")!;
  expect(video.getAttribute("src")).toBe(`/api/pronunciation-media/${KEY_VIDEO}`);
  expect(video.hasAttribute("controls") && video.hasAttribute("loop")).toBe(true);
  rerender(<MouthMedia mediaKey={KEY_IMAGE} label="Boca en «hot»" />);
  expect(screen.getByRole("img", { name: "Boca en «hot»" })).toBeTruthy();
});

it("sube el archivo al BFF y guarda la clave; «Quitar» la borra; > 30 MB no se envía", async () => {
  const onChange = jest.fn();
  global.fetch = jest.fn(async () => ({ ok: true, status: 201, json: async () => ({ data: { key: KEY_IMAGE, type: "image" } }) })) as never; // jsdom no trae `Response`
  const { container, rerender } = render(<MouthMediaField value="" onChange={onChange} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;

  fireEvent.change(input, { target: { files: [new File(["x"], "boca.jpg", { type: "image/jpeg" })] } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(KEY_IMAGE));
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/pronunciation-media");

  const big = new File(["x"], "grande.mp4", { type: "video/mp4" });
  Object.defineProperty(big, "size", { value: 31 * 1024 * 1024 });
  fireEvent.change(input, { target: { files: [big] } });
  expect(await screen.findByText(/supera 30 MB/)).toBeTruthy();
  expect(global.fetch).toHaveBeenCalledTimes(1);

  rerender(<MouthMediaField value={KEY_IMAGE} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /Quitar/ }));
  expect(onChange).toHaveBeenLastCalledWith("");
});

// [2026-11-14 · URL]: enlace https de imagen, .mp4 o YouTube (iframe youtube-nocookie) · http o texto suelto → error, sin guardar
it("acepta URL: YouTube → iframe, .mp4 → video, otra → imagen; el campo valida https", () => {
  expect(mouthMediaKind("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
  expect(mouthMediaKind("https://cdn.example.com/boca.MP4?x=1")).toBe("video");
  expect(mouthMediaKind("https://cdn.example.com/boca.png")).toBe("image");
  expect(mouthMediaKind(KEY_VIDEO)).toBe("video");

  const { container } = render(<MouthMedia mediaKey="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />);
  expect(container.querySelector("iframe")?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");

  const onChange = jest.fn();
  render(<MouthMediaField value="" onChange={onChange} />);
  const url = screen.getByLabelText(/Enlace de la imagen/);
  fireEvent.change(url, { target: { value: "http://inseguro.com/a.png" } });
  fireEvent.click(screen.getByRole("button", { name: /Usar enlace/ }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText(/https:\/\//, { selector: "p" })).toBeTruthy();
  fireEvent.change(url, { target: { value: " https://youtu.be/dQw4w9WgXcQ " } });
  fireEvent.keyDown(url, { key: "Enter" });
  expect(onChange).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ");
});
