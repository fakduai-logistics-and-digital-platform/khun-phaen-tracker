"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EditorCreateSuiteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string) => Promise<boolean>;
};

export function EditorCreateSuiteDialog({ open, onOpenChange, onCreate }: EditorCreateSuiteDialogProps) {
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    if (await onCreate(name)) {
      setName("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Suite</DialogTitle>
          <DialogDescription>Enter a name for the new test suite.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="new-suite-name">Suite Name</Label>
          <Input
            id="new-suite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
            placeholder="e.g. Authentication, Dashboard..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!name.trim()} onClick={() => void create()}>
            Create Suite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
