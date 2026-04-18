export interface NoteMetadata {
  created: string;
  updated: string[];
}

export interface Note {
  id: number;
  title: string;
  content: string;
  metadata: NoteMetadata;
}

export interface NotesResponse {
  notes: Note[];
}

export interface NoteResponse {
  note: Note;
}

export interface NoteInput {
  title: string;
  content: string;
}
