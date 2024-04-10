export interface HttpResponse {
    ok: boolean;
    status: number;
    data: string;
}

export interface Caption {
    baseUrl: string;
    name: {
        simpleText: string;
    };
    languageCode: string;
    kind?: string;
    isTranslatable?: boolean;
}

export interface CaptionsJson {
    captionTracks: Caption[];
    translationLanguages?: {
        languageName: {
            simpleText: string;
        };
        languageCode: string;
    }[];
}