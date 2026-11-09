export type HelpVideo = {
  id: string;
  youtubeId: string;
  titleKey: string;
  descriptionKey: string;
  seenKey: string;
};

export const GETTING_STARTED_VIDEO: HelpVideo = {
  id: "getting-started",
  youtubeId: "og4aNrUy1rI",
  titleKey: "help__video_start_title",
  descriptionKey: "help__video_start_desc",
  seenKey: "kp_help_seen_getting_started",
};

export const QA_VIDEO: HelpVideo = {
  id: "qa",
  youtubeId: "DPHJY3ufHg8",
  titleKey: "help__video_qa_title",
  descriptionKey: "help__video_qa_desc",
  seenKey: "kp_help_seen_qa",
};

export const HELP_VIDEOS = [GETTING_STARTED_VIDEO, QA_VIDEO];
