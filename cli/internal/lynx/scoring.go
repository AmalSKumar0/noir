package lynx

import (
	"path/filepath"
	"strings"
)

type LanguageClassification struct {
	Primary    []string `json:"primary"`
	Secondary  []string `json:"secondary"`
	Supporting []string `json:"supporting"`
}

type Score struct {
	Language        LanguageClassification `json:"language"`
	Frameworks      map[string]int         `json:"frameworks"`
	Libraries       map[string]int         `json:"libraries"`
	Runtimes        map[string]int         `json:"runtimes"`
	Tools           map[string]int         `json:"tools"`
	PackageManagers map[string]int         `json:"package_managers"`
	Configuration   map[string]int         `json:"configuration"`
	FileReadData    map[string]int         `json:"file_read_data"`
}

func NewScore() *Score {
	return &Score{
		Language: LanguageClassification{
			Primary:    []string{},
			Secondary:  []string{},
			Supporting: []string{},
		},
		Frameworks:      make(map[string]int),
		Libraries:       make(map[string]int),
		Runtimes:        make(map[string]int),
		Tools:           make(map[string]int),
		PackageManagers: make(map[string]int),
		Configuration:   make(map[string]int),
		FileReadData:    make(map[string]int),
	}
}

func (s *Score) LoadLanguages(langPct map[string]float64) {
	for lang, pct := range langPct {
		if pct >= 50.0 {
			s.Language.Primary = append(s.Language.Primary, lang)
		} else if pct >= 10.0 {
			s.Language.Secondary = append(s.Language.Secondary, lang)
		} else if pct >= 1.0 {
			s.Language.Supporting = append(s.Language.Supporting, lang)
		}
	}
}

func (s *Score) PutData(category, technology string, count int) {
	switch category {
	case "frameworks":
		s.Frameworks[technology] += count
	case "libraries":
		s.Libraries[technology] += count
	case "runtimes":
		s.Runtimes[technology] += count
	case "tools":
		s.Tools[technology] += count
	case "package_managers":
		s.PackageManagers[technology] += count
	case "configuration":
		s.Configuration[technology] += count
	}
}

type techCategoryPair struct {
	Category   string
	Technology string
}

var (
	basenameToTech map[string]techCategoryPair
	suffixToTech   map[string]techCategoryPair
	techToCategory map[string]string
)

func init() {
	basenameToTech = make(map[string]techCategoryPair)
	suffixToTech = make(map[string]techCategoryPair)
	techToCategory = make(map[string]string)

	for cat, fileMap := range FilesToTechnology {
		for pathKey, tech := range fileMap {
			techToCategory[tech] = cat
			if strings.Contains(pathKey, "/") {
				suffixToTech[pathKey] = techCategoryPair{Category: cat, Technology: tech}
			} else {
				basenameToTech[pathKey] = techCategoryPair{Category: cat, Technology: tech}
			}
		}
	}
}

func LanguageScoringEngine(extData map[string]int, score *Score) {
	langCounts := make(map[string]int)
	total := 0

	for ext, count := range extData {
		lang, ok := ExtensionToLanguage[ext]
		if !ok {
			continue
		}
		total += count
		langCounts[lang] += count
	}

	langPct := make(map[string]float64)
	if total > 0 {
		for lang, count := range langCounts {
			pct := (float64(count) / float64(total)) * 100.0
			if pct >= 1.0 {
				langPct[lang] = pct
			}
		}
	}

	score.LoadLanguages(langPct)
}

func DependencyScoringEngine(deps map[string]int, score *Score) {
	for tech, count := range deps {
		cat, ok := techToCategory[tech]
		if !ok {
			cat = "libraries"
		}
		score.PutData(cat, tech, count)
	}
}

func FrameworkScoringEngine(files map[string]int, score *Score) {
	for relPath, count := range files {
		base := filepath.Base(relPath)

		if pair, ok := basenameToTech[base]; ok {
			score.PutData(pair.Category, pair.Technology, count)
			continue
		}

		for suffix, pair := range suffixToTech {
			if strings.HasSuffix(relPath, suffix) {
				score.PutData(pair.Category, pair.Technology, count)
				break
			}
		}
	}
}

func ScoringEngine(evidence *Evidence) *Score {
	score := NewScore()
	LanguageScoringEngine(evidence.FileExtension, score)
	score.FileReadData = evidence.Dependencies
	DependencyScoringEngine(score.FileReadData, score)
	FrameworkScoringEngine(evidence.Files, score)
	return score
}
