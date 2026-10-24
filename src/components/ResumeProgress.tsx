import type { AnalysisProgress } from "../api/types";
import { analysisFraction, analysisSteps } from "../lib/progress";
import { Fact, TaskProgress } from "./TaskProgress";

function headline(analysis: AnalysisProgress | null): string {
  if (!analysis) return "Sending your file to the server";

  switch (analysis.phase) {
    case "reading":
      return "Reading the text of your CV";
    case "understanding":
      return analysis.reused
        ? "You uploaded this CV before, so there is nothing new to read"
        : "Working out your skills, jobs and education";
    case "saving":
      return "Saving what we found";
    default:
      return "Getting started";
  }
}

/**
 * What the server is doing with an uploaded CV. `analysis` is null for the moment before the server has
 * answered, while the file is still travelling.
 */
export function ResumeProgress({ analysis, fileName, receivedAt, startedLocallyAt }: { analysis: AnalysisProgress | null; fileName: string; receivedAt: number; startedLocallyAt: number }) {
  const writing = analysis?.phase === "understanding" && !analysis.reused ? Math.round(analysis.writing * 100) : null;

  return (
    <TaskProgress
      title="Reading your CV"
      headline={headline(analysis)}
      steps={analysisSteps(analysis)}
      fraction={analysisFraction(analysis)}
      // before the server answers there is no server clock, so the page's own measures the wait
      elapsedMs={analysis?.elapsedMs ?? 0}
      receivedAt={analysis ? receivedAt : startedLocallyAt}
      running
    >
      <dl className="facts">
        <Fact label="File">
          <span className="wrap">{analysis?.fileName ?? fileName}</span>
        </Fact>
        {analysis?.characters != null && <Fact label="Text read">{`${analysis.characters.toLocaleString()} characters`}</Fact>}
        {analysis?.skills != null && <Fact label="Skills found">{analysis.skills}</Fact>}
        {analysis?.links != null && analysis.links > 0 && <Fact label="Links found">{analysis.links}</Fact>}
        {writing !== null && <Fact label="Profile written">{`about ${writing}%`}</Fact>}
      </dl>

      <p className="muted small">
        {analysis?.reused
          ? "This only takes a moment."
          : "A model on this server reads your CV, which takes 30 to 90 seconds the first time. Uploading the same file again later is instant. You can leave this page; reading keeps going."}
      </p>
    </TaskProgress>
  );
}
