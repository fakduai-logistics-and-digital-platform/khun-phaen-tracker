/** Renders **bold** markers inside a translated string, so help copy can keep emphasis without JSX in locale files. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-medium text-foreground">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
