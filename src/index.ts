import { Elysia, t } from "elysia";
import { fetchTranscriptList, TranscriptList, Transcript } from "./transcripts";
import { HttpResponse } from "./types";

const app = new Elysia();

app.get("/", () => "Hello Elysia");

app.get("/:id", async ({ params: { id } }) => {
  try {
    const transcriptList: TranscriptList = await fetchTranscriptList(id);

    const transcript: Transcript = transcriptList.findTranscript(["en"]);

    const actualTranscript = await transcript.fetch();

    let completedTranscript = ""

    for (const line of actualTranscript) {
      completedTranscript += line.text + " ";
    }

    return completedTranscript;
  } catch (error) {
    console.error("Error fetching transcript:", error);
    throw new Error("Failed to fetch transcript");
  }
});

app.listen(3000);
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);