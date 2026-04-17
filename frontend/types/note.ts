export interface Note {
  id: number;
  title: string;
  content: string;
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
