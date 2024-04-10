import { couldNotRetrieveTranscript, youTubeRequestFailed, videoUnavailable, invalidVideoId, tooManyRequests, transcriptsDisabled, noTranscriptAvailable, notTranslatable, translationLanguageNotAvailable, cookiePathInvalid, cookiesInvalid, failedToCreateConsentCookie } from "./errors";
import { CaptionsJson, HttpResponse } from "./types";
import { DOMParser } from "xmldom";

const WATCH_URL = "https://www.youtube.com/watch?v={video_id}";

const raiseHttpErrors = (response: Response, videoId: string): Response => {
    if (!response.ok) {
        throw youTubeRequestFailed(videoId, `HTTP error! status: ${response.status}`);
    }
    return response;
};

const fetchTranscriptList = async (videoId: string): Promise<TranscriptList> => {
    const html = await fetchVideoHtml(videoId);
    const captionsJson = extractCaptionsJson(html, videoId);
    return buildTranscriptList(videoId, captionsJson);
};

const extractCaptionsJson = (html: string, videoId: string): CaptionsJson => {
    const splittedHtml = html.split('"captions":');

    if (splittedHtml.length <= 1) {
        if (videoId.startsWith("http://") || videoId.startsWith("https://")) {
            throw invalidVideoId(videoId);
        }
        if (html.includes('class="g-recaptcha"')) {
            throw tooManyRequests(videoId);
        }
        if (!html.includes('"playabilityStatus":')) {
            throw videoUnavailable(videoId);
        }

        throw transcriptsDisabled(videoId);
    }

    const captionsJson = JSON.parse(
        splittedHtml[1].split(',"videoDetails')[0].replace("\n", "")
    ).playerCaptionsTracklistRenderer;

    if (!captionsJson) {
        throw transcriptsDisabled(videoId);
    }

    if (!captionsJson.captionTracks) {
        throw noTranscriptAvailable(videoId);
    }

    return captionsJson;
};

const createConsentCookie = async (html: string, videoId: string): Promise<void> => {
    const match = html.match(/name="v" value="(.*?)"/);
    if (!match) {
        throw failedToCreateConsentCookie(videoId);
    }
    document.cookie = `CONSENT=YES+${match[1]}; domain=.youtube.com; path=/`;
};
const fetchVideoHtml = async (videoId: string): Promise<string> => {
    let html = await fetchHtml(videoId);
    if (html.includes('action="https://consent.youtube.com/s"')) {
        await createConsentCookie(html, videoId);
        html = await fetchHtml(videoId);
        if (html.includes('action="https://consent.youtube.com/s"')) {
            throw failedToCreateConsentCookie(videoId);
        }
    }
    return html;
};

const fetchHtml = async (videoId: string): Promise<string> => {
    const response: Response = await fetch(WATCH_URL.replace("{video_id}", videoId), {
        headers: { "Accept-Language": "en-US" },
    });
    const raisedResponse = raiseHttpErrors(response, videoId);
    return unescape(await raisedResponse.text());
};

interface TranscriptList {
    videoId: string;
    findTranscript(languageCodes: string[]): Transcript;
    findGeneratedTranscript(languageCodes: string[]): Transcript;
    findManuallyCreatedTranscript(languageCodes: string[]): Transcript;
    toString(): string;
}

const buildTranscriptList = (videoId: string, captionsJson: CaptionsJson): TranscriptList => {
    const translationLanguages = (captionsJson.translationLanguages || []).map((translationLanguage) => ({
        language: translationLanguage.languageName.simpleText,
        languageCode: translationLanguage.languageCode,
    }));

    const manuallyCreatedTranscripts: Record<string, Transcript> = {};
    const generatedTranscripts: Record<string, Transcript> = {};

    for (const caption of captionsJson.captionTracks) {
        const transcriptDict = caption.kind === "asr" ? generatedTranscripts : manuallyCreatedTranscripts;
        transcriptDict[caption.languageCode] = createTranscript(
            videoId,
            caption.baseUrl,
            caption.name.simpleText,
            caption.languageCode,
            caption.kind === "asr",
            caption.isTranslatable ? translationLanguages : []
        );
    }

    return {
        videoId,
        findTranscript: (languageCodes: string[]) =>
            findTranscript(videoId, languageCodes, [manuallyCreatedTranscripts, generatedTranscripts]),
        findGeneratedTranscript: (languageCodes: string[]) =>
            findTranscript(videoId, languageCodes, [generatedTranscripts]),
        findManuallyCreatedTranscript: (languageCodes: string[]) =>
            findTranscript(videoId, languageCodes, [manuallyCreatedTranscripts]),
        toString: () =>
            `For this video (${videoId}) transcripts are available in the following languages:

(MANUALLY CREATED)
${getLanguageDescription(Object.values(manuallyCreatedTranscripts).map((transcript) => transcript.toString()))}

(GENERATED)
${getLanguageDescription(Object.values(generatedTranscripts).map((transcript) => transcript.toString()))}

(TRANSLATION LANGUAGES)
${getLanguageDescription(
                translationLanguages.map(
                    (translationLanguage) => `${translationLanguage.languageCode} ("${translationLanguage.language}")`
                )
            )}`,
    };
};

const findTranscript = (
    videoId: string,
    languageCodes: string[],
    transcriptDicts: Record<string, Transcript>[]
): Transcript => {
    for (const languageCode of languageCodes) {
        for (const transcriptDict of transcriptDicts) {
            if (languageCode in transcriptDict) {
                return transcriptDict[languageCode];
            }
        }
    }

    throw noTranscriptFound(videoId, languageCodes, transcriptDicts);
};

const noTranscriptFound = (videoId: string, languageCodes: string[], transcriptDicts: Record<string, Transcript>[]): Error => {
    return new Error(`No transcript found for video ${videoId} with language codes ${languageCodes.join(", ")}`);
};

const getLanguageDescription = (transcriptStrings: string[]): string => {
    const description = transcriptStrings.map((transcript) => ` - ${transcript}`).join("\n");
    return description || "None";
};

interface Transcript {
    videoId: string;
    language: string;
    languageCode: string;
    isGenerated: boolean;
    translationLanguages: { language: string; languageCode: string }[];
    fetch(preserveFormatting?: boolean): Promise<{ text: string; start: number; duration: number }[]>;
    toString(): string;
    isTranslatable: boolean;
    translate(languageCode: string): Transcript;
}

const createTranscript = (
    videoId: string,
    url: string,
    language: string,
    languageCode: string,
    isGenerated: boolean,
    translationLanguages: { language: string; languageCode: string }[]
): Transcript => {
    const translationLanguagesDict = translationLanguages.reduce(
        (dict, translationLanguage) => ({
            ...dict,
            [translationLanguage.languageCode]: translationLanguage.language,
        }),
        {}
    );

    return {
        videoId,
        language,
        languageCode,
        isGenerated,
        translationLanguages,
        fetch: async (preserveFormatting = false) => {
            const response: Response = await fetch(url, {
                headers: { "Accept-Language": "en-US" },
            });
            const raisedResponse = raiseHttpErrors(response, videoId);
            return parseTranscript(await raisedResponse.text(), preserveFormatting);
        },
        toString: () =>
            `${languageCode} ("${language}")${translationLanguages.length > 0 ? "[TRANSLATABLE]" : ""}`,
        isTranslatable: translationLanguages.length > 0,
        translate: (languageCode: string) => {
            if (translationLanguages.length === 0) {
                throw notTranslatable(videoId);
            }

            if (!(languageCode in translationLanguagesDict)) {
                throw translationLanguageNotAvailable(videoId);
            }

            return createTranscript(
                videoId,
                `${url}&tlang=${languageCode}`,
                translationLanguagesDict[languageCode as keyof typeof translationLanguagesDict],
                languageCode,
                true,
                []
            );
        },
    };
};

const parseTranscript = (
    plainData: string,
    preserveFormatting: boolean
  ): { text: string; start: number; duration: number }[] => {
    const htmlRegex = getHtmlRegex(preserveFormatting);
    const xmlElements = new DOMParser().parseFromString(plainData, "text/xml").getElementsByTagName("text");

    return Array.from(xmlElements)
        .filter((xmlElement) => xmlElement.textContent)
        .map((xmlElement) => ({
            text: xmlElement.textContent!.replace(htmlRegex, ""),
            start: Number(xmlElement.getAttribute("start")),
            duration: Number(xmlElement.getAttribute("dur") || "0.0"),
        }));
};

const getHtmlRegex = (preserveFormatting: boolean): RegExp => {
    if (preserveFormatting) {
        const formatsRegex = [
            "strong", // important
            "em", // emphasized
            "b", // bold
            "i", // italic
            "mark", // marked
            "small", // smaller
            "del", // deleted
            "ins", // inserted
            "sub", // subscript
            "sup", // superscript
        ].join("|");
        return new RegExp(`</?(?!/?(?:${formatsRegex})\\b).*?\\b>`, "gi");
    } else {
        return /<[^>]*>/gi;
    }
};

function unescape(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export { fetchTranscriptList, TranscriptList, Transcript };