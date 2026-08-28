package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDotEnvLoadsValuesWithoutOverwritingEnvironment(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("FROM_FILE=value\nQUOTED=\"hello world\"\nKEEP=file-value\n"), 0600); err != nil {
		t.Fatal(err)
	}
	oldDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	defer os.Chdir(oldDir)
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	t.Setenv("KEEP", "process-value")
	if err := LoadDotEnv(); err != nil {
		t.Fatal(err)
	}
	if got := os.Getenv("FROM_FILE"); got != "value" {
		t.Fatalf("FROM_FILE = %q", got)
	}
	if got := os.Getenv("QUOTED"); got != "hello world" {
		t.Fatalf("QUOTED = %q", got)
	}
	if got := os.Getenv("KEEP"); got != "process-value" {
		t.Fatalf("KEEP = %q", got)
	}
}
