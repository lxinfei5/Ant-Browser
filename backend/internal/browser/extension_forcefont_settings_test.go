package browser

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"ant-chrome/backend/internal/browser/builtins/forcefont"
)

func TestNormalizeForceFontSettings(t *testing.T) {
	t.Parallel()

	got, err := NormalizeForceFontSettings(ForceFontSettings{})
	if err != nil {
		t.Fatalf("default: %v", err)
	}
	if got.Preset != "default" || got.LatinFont != "Monaco" || got.CjkFont != "Microsoft YaHei" || got.CjkSizeAdjust != "95%" {
		t.Fatalf("default = %+v", got)
	}

	got, err = NormalizeForceFontSettings(ForceFontSettings{Preset: "typewriter", LatinFont: "ignored", CjkFont: "ignored"})
	if err != nil {
		t.Fatalf("typewriter: %v", err)
	}
	if got.LatinFont != "American Typewriter" || got.CjkFont != "Source Han Serif SC" || got.CjkSizeAdjust != "98%" {
		t.Fatalf("typewriter = %+v", got)
	}

	got, err = NormalizeForceFontSettings(ForceFontSettings{
		Preset:        "custom",
		LatinFont:     "American Typewriter",
		CjkFont:       "思源宋体",
		CjkSizeAdjust: "100",
	})
	if err != nil {
		t.Fatalf("custom: %v", err)
	}
	if got.LatinFont != "American Typewriter" || got.CjkFont != "思源宋体" || got.CjkSizeAdjust != "100%" {
		t.Fatalf("custom = %+v", got)
	}

	if _, err := NormalizeForceFontSettings(ForceFontSettings{Preset: "custom", LatinFont: `Monaco";} body{`, CjkFont: "微软雅黑"}); err == nil {
		t.Fatal("expected css injection to fail")
	}
	if _, err := NormalizeForceFontSettings(ForceFontSettings{Preset: "unknown"}); err == nil {
		t.Fatal("expected unknown preset to fail")
	}
}

func TestForceFontSettingsSidecarRoundTripAndRepair(t *testing.T) {
	mgr, _ := newExtensionTestManager(t)
	if err := mgr.EnsureBuiltinExtensions(); err != nil {
		t.Fatalf("Ensure: %v", err)
	}

	got, err := mgr.ForceFontSettings()
	if err != nil {
		t.Fatalf("Get empty: %v", err)
	}
	if got.Preset != "default" || got.LatinFont != "Monaco" {
		t.Fatalf("empty default = %+v", got)
	}

	saved, err := mgr.SaveForceFontSettings(ForceFontSettings{Preset: "typewriter"})
	if err != nil {
		t.Fatalf("Save: %v", err)
	}
	if saved.Preset != "typewriter" || saved.UpdatedAt == "" {
		t.Fatalf("saved = %+v", saved)
	}

	path := filepath.Join(mgr.builtinForceFontInstallDir(), forcefont.UserSettingsFileName)
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read sidecar: %v", err)
	}
	var disk ForceFontSettings
	if err := json.Unmarshal(raw, &disk); err != nil {
		t.Fatalf("unmarshal sidecar: %v", err)
	}
	if disk.CjkFont != "Source Han Serif SC" {
		t.Fatalf("sidecar cjk = %q", disk.CjkFont)
	}

	contentPath := filepath.Join(mgr.builtinForceFontInstallDir(), "content.js")
	if err := os.WriteFile(contentPath, []byte("tampered"), 0o644); err != nil {
		t.Fatalf("tamper: %v", err)
	}
	if err := os.WriteFile(filepath.Join(mgr.builtinForceFontInstallDir(), "evil.js"), []byte("x"), 0o644); err != nil {
		t.Fatalf("extra: %v", err)
	}

	if err := mgr.EnsureBuiltinExtensions(); err != nil {
		t.Fatalf("Ensure after tamper: %v", err)
	}
	if _, err := os.Stat(filepath.Join(mgr.builtinForceFontInstallDir(), "evil.js")); !os.IsNotExist(err) {
		t.Fatal("expected extra file removed")
	}
	restored, err := mgr.ForceFontSettings()
	if err != nil {
		t.Fatalf("Get after repair: %v", err)
	}
	if restored.Preset != "typewriter" || restored.LatinFont != "American Typewriter" {
		t.Fatalf("sidecar lost after repair: %+v", restored)
	}
	data, err := os.ReadFile(contentPath)
	if err != nil {
		t.Fatalf("read content: %v", err)
	}
	if strings.Contains(string(data), "tampered") {
		t.Fatal("content.js still tampered")
	}
}
