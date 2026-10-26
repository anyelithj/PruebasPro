// [Test youtubeEmbed · 2026-10-25]: enlaces de YouTube → URL de inserción · el resto → null
import { youtubeEmbed } from "@/lib/youtube";

it("reconoce watch, youtu.be y shorts; ignora otros enlaces", () => {
  expect(youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(youtubeEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(youtubeEmbed("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  expect(youtubeEmbed(null)).toBeNull();
});
