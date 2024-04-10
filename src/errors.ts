type ErrorCause = string;

interface TranscriptError extends Error {
  cause?: ErrorCause;
}

const WATCH_URL = 'https://www.youtube.com/watch?v={video_id}';

const buildErrorMessage = (videoId: string, errorMessage: string, cause?: ErrorCause): string => {
  let message = errorMessage.replace('{video_url}', WATCH_URL.replace('{video_id}', videoId));

  if (cause) {
    message += `\nThis is most likely caused by:\n\n${cause}`;
  }

  return message;
};

const createTranscriptError = (videoId: string, errorMessage: string, cause?: ErrorCause): TranscriptError => {
  const error = new Error(buildErrorMessage(videoId, errorMessage, cause)) as TranscriptError;
  error.cause = cause;
  return error;
};


export const couldNotRetrieveTranscript = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!');

export const youTubeRequestFailed = (videoId: string, httpError: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', `Request to YouTube failed: ${httpError}`);

export const videoUnavailable = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'The video is no longer available');

export const invalidVideoId = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'You provided an invalid video id. Make sure you are using the video id and NOT the url!\n\nDo NOT run: `YouTubeTranscriptApi.get_transcript("https://www.youtube.com/watch?v=1234")`\nInstead run: `YouTubeTranscriptApi.get_transcript("1234")`');

export const tooManyRequests = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'YouTube is receiving too many requests from this IP and now requires solving a captcha to continue. One of the following things can be done to work around this:\n- Manually solve the captcha in a browser and export the cookie. Read here how to use that cookie with youtube-transcript-api: https://github.com/jdepoix/youtube-transcript-api#cookies\n- Use a different IP address\n- Wait until the ban on your IP has been lifted');

export const transcriptsDisabled = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'Subtitles are disabled for this video');

export const noTranscriptAvailable = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'No transcripts are available for this video');

export const notTranslatable = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'The requested language is not translatable');

export const translationLanguageNotAvailable = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'The requested translation language is not available');

export const cookiePathInvalid = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'The provided cookie file was unable to be loaded');

export const cookiesInvalid = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'The cookies provided are not valid (may have expired)');

export const failedToCreateConsentCookie = (videoId: string): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', 'Failed to automatically give consent to saving cookies');

export const noTranscriptFound = (videoId: string, requestedLanguageCodes: string[], transcriptData: any): TranscriptError =>
  createTranscriptError(videoId, 'Could not retrieve a transcript for the video {video_url}!', `No transcripts were found for any of the requested language codes: ${requestedLanguageCodes}\n\n${JSON.stringify(transcriptData)}`);