interface BuiltInTranslatorInstance {
  translate(input: string): Promise<string>;
  destroy?: () => void;
}

interface BuiltInTranslator {
  availability?: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<BuiltInTranslatorInstance>;
}

const TRANSLATOR_OPTIONS = { sourceLanguage: "th", targetLanguage: "en" } as const;

function getTranslatorApi(): BuiltInTranslator | null {
  if (typeof window === "undefined") return null;
  const maybeTranslator = (window as unknown as { Translator?: BuiltInTranslator }).Translator;
  if (!maybeTranslator || typeof maybeTranslator.create !== "function") return null;
  return maybeTranslator;
}

async function createTranslatorInstance(): Promise<BuiltInTranslatorInstance | null> {
  const translatorApi = getTranslatorApi();
  if (!translatorApi) return null;

  try {
    if (typeof translatorApi.availability === "function") {
      const availability = await translatorApi.availability(TRANSLATOR_OPTIONS);
      if (availability === "unavailable") return null;
    }
    return await translatorApi.create(TRANSLATOR_OPTIONS);
  } catch (error) {
    console.warn("Translator API unavailable:", error);
    return null;
  }
}

/** Translates Thai task titles to English: MyMemory first, then the browser's built-in Translator API. */
export function createBranchTranslator() {
  let translator: BuiltInTranslatorInstance | null = null;
  let initPromise: Promise<BuiltInTranslatorInstance | null> | null = null;

  async function getOrCreateTranslator() {
    if (translator) return translator;
    if (!initPromise) {
      initPromise = createTranslatorInstance()
        .then((instance) => {
          translator = instance;
          return instance;
        })
        .finally(() => {
          initPromise = null;
        });
    }
    return initPromise;
  }

  async function translateTitle(input: string): Promise<{ text: string; translated: boolean }> {
    const cleaned = input.trim();
    if (!cleaned) return { text: "", translated: false };

    const isEnglish =
      [...cleaned.replace(/\s/g, "")].every((ch) => ch.charCodeAt(0) < 128) && cleaned.replace(/\s/g, "").length > 0;
    if (isEnglish) return { text: cleaned, translated: false };

    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=th|en`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          const translatedText = String(data.responseData.translatedText).trim();
          if (translatedText && translatedText.toLowerCase() !== cleaned.toLowerCase()) {
            return { text: translatedText, translated: true };
          }
        }
      }
    } catch (error) {
      console.warn("MyMemory API failed:", error);
    }

    const instance = await getOrCreateTranslator();
    if (instance) {
      try {
        const translatedText = (await instance.translate(cleaned)).trim();
        if (translatedText) return { text: translatedText, translated: true };
      } catch (error) {
        console.warn("Chrome Translator API failed:", error);
      }
    }

    return { text: cleaned, translated: false };
  }

  return {
    translateTitle,
    warmUp: getOrCreateTranslator,
    destroy: () => translator?.destroy?.(),
  };
}
