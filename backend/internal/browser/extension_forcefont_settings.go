package browser

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"ant-chrome/backend/internal/browser/builtins/forcefont"
)

const (
	forceFontPresetDefault    = "default"
	forceFontPresetTypewriter = "typewriter"
	forceFontPresetCustom     = "custom"
	forceFontDefaultLatin     = "Monaco"
	forceFontDefaultCJK       = "Microsoft YaHei"
	forceFontDefaultAdjust    = "95%"
	forceFontTypewriterLatin  = "American Typewriter"
	forceFontTypewriterCJK    = "Source Han Serif SC"
	forceFontTypewriterAdjust = "98%"
	forceFontMaxNameRunes     = 80
)

func defaultForceFontSettings() ForceFontSettings {
	return ForceFontSettings{
		Preset:        forceFontPresetDefault,
		LatinFont:     forceFontDefaultLatin,
		CjkFont:       forceFontDefaultCJK,
		CjkSizeAdjust: forceFontDefaultAdjust,
	}
}

func (m *Manager) forceFontUserSettingsPath() string {
	return filepath.Join(m.builtinForceFontInstallDir(), forcefont.UserSettingsFileName)
}

func (m *Manager) ForceFontSettings() (ForceFontSettings, error) {
	if m == nil {
		return ForceFontSettings{}, fmt.Errorf("浏览器管理器未初始化")
	}
	if _, err := m.syncBuiltinForceFont(); err != nil {
		return ForceFontSettings{}, err
	}
	return readForceFontSettingsFile(m.forceFontUserSettingsPath())
}

func (m *Manager) SaveForceFontSettings(input ForceFontSettings) (ForceFontSettings, error) {
	if m == nil {
		return ForceFontSettings{}, fmt.Errorf("浏览器管理器未初始化")
	}
	input.UpdatedAt = ""
	normalized, err := NormalizeForceFontSettings(input)
	if err != nil {
		return ForceFontSettings{}, err
	}
	if _, err := m.syncBuiltinForceFont(); err != nil {
		return ForceFontSettings{}, err
	}
	data, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return ForceFontSettings{}, fmt.Errorf("编码字体设置失败: %w", err)
	}
	path := m.forceFontUserSettingsPath()
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return ForceFontSettings{}, fmt.Errorf("写入字体设置失败: %w", err)
	}
	return normalized, nil
}

func readForceFontSettingsFile(path string) (ForceFontSettings, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultForceFontSettings(), nil
		}
		return ForceFontSettings{}, fmt.Errorf("读取字体设置失败: %w", err)
	}
	var parsed ForceFontSettings
	if err := json.Unmarshal(data, &parsed); err != nil {
		return defaultForceFontSettings(), nil
	}
	normalized, err := normalizeForceFontSettings(parsed, "")
	if err != nil {
		return defaultForceFontSettings(), nil
	}
	return normalized, nil
}

func NormalizeForceFontSettings(input ForceFontSettings) (ForceFontSettings, error) {
	return normalizeForceFontSettings(input, time.Now().UTC().Format(time.RFC3339))
}

func normalizeForceFontSettings(input ForceFontSettings, now string) (ForceFontSettings, error) {
	preset := strings.TrimSpace(input.Preset)
	if preset == "" {
		preset = forceFontPresetDefault
	}
	updatedAt := strings.TrimSpace(input.UpdatedAt)
	if updatedAt == "" {
		updatedAt = now
	}

	switch preset {
	case forceFontPresetDefault:
		return ForceFontSettings{
			Preset:        forceFontPresetDefault,
			LatinFont:     forceFontDefaultLatin,
			CjkFont:       forceFontDefaultCJK,
			CjkSizeAdjust: forceFontDefaultAdjust,
			UpdatedAt:     updatedAt,
		}, nil
	case forceFontPresetTypewriter:
		return ForceFontSettings{
			Preset:        forceFontPresetTypewriter,
			LatinFont:     forceFontTypewriterLatin,
			CjkFont:       forceFontTypewriterCJK,
			CjkSizeAdjust: forceFontTypewriterAdjust,
			UpdatedAt:     updatedAt,
		}, nil
	case forceFontPresetCustom:
		latin, err := sanitizeForceFontName(input.LatinFont)
		if err != nil {
			return ForceFontSettings{}, fmt.Errorf("西文字体无效: %w", err)
		}
		cjk, err := sanitizeForceFontName(input.CjkFont)
		if err != nil {
			return ForceFontSettings{}, fmt.Errorf("中文字体无效: %w", err)
		}
		return ForceFontSettings{
			Preset:        forceFontPresetCustom,
			LatinFont:     latin,
			CjkFont:       cjk,
			CjkSizeAdjust: normalizeForceFontSizeAdjust(input.CjkSizeAdjust, forceFontDefaultAdjust),
			UpdatedAt:     updatedAt,
		}, nil
	default:
		return ForceFontSettings{}, fmt.Errorf("未知的字体预设: %s", preset)
	}
}

func sanitizeForceFontName(name string) (string, error) {
	value := strings.TrimSpace(name)
	if value == "" {
		return "", fmt.Errorf("字体名不能为空")
	}
	if utf8.RuneCountInString(value) > forceFontMaxNameRunes {
		return "", fmt.Errorf("字体名过长")
	}
	for i, r := range value {
		if !isForceFontNameRune(r, i == 0) {
			return "", fmt.Errorf("字体名含非法字符")
		}
	}
	return value, nil
}

func isForceFontNameRune(r rune, first bool) bool {
	if r == '_' || unicode.IsLetter(r) || unicode.IsNumber(r) {
		return true
	}
	if first {
		return false
	}
	return r == ' ' || r == '.' || r == '+' || r == '-'
}

func normalizeForceFontSizeAdjust(value, fallback string) string {
	raw := strings.TrimSpace(value)
	raw = strings.TrimSuffix(raw, "%")
	raw = strings.TrimSpace(raw)
	n, err := strconv.Atoi(raw)
	if err != nil || n < 80 || n > 120 {
		return fallback
	}
	return fmt.Sprintf("%d%%", n)
}
