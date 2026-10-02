package lynx

var Thresholds = map[string]int{
	"frameworks":       5,
	"libraries":        5,
	"runtimes":         5,
	"tools":            5,
	"package_managers": 1,
	"configuration":    1,
}

type IdentifiedResult struct {
	Language        LanguageClassification `json:"language"`
	Frameworks      map[string]int         `json:"frameworks"`
	Libraries       map[string]int         `json:"libraries"`
	Runtimes        map[string]int         `json:"runtimes"`
	Tools           map[string]int         `json:"tools"`
	PackageManagers map[string]int         `json:"package_managers"`
	Configuration   map[string]int         `json:"configuration"`
}

type IdentificationEngine struct {
	Score  *Score
	Result *IdentifiedResult
}

func NewIdentificationEngine(score *Score) *IdentificationEngine {
	return &IdentificationEngine{
		Score: score,
		Result: &IdentifiedResult{
			Language:        score.Language,
			Frameworks:      make(map[string]int),
			Libraries:       make(map[string]int),
			Runtimes:        make(map[string]int),
			Tools:           make(map[string]int),
			PackageManagers: make(map[string]int),
			Configuration:   make(map[string]int),
		},
	}
}

func filterCategory(data map[string]int, threshold int) map[string]int {
	res := make(map[string]int)
	for k, v := range data {
		if v >= threshold {
			res[k] = v
		}
	}
	return res
}

func (ie *IdentificationEngine) Identify() *IdentifiedResult {
	ie.Result.Frameworks = filterCategory(ie.Score.Frameworks, Thresholds["frameworks"])
	ie.Result.Libraries = filterCategory(ie.Score.Libraries, Thresholds["libraries"])
	ie.Result.Runtimes = filterCategory(ie.Score.Runtimes, Thresholds["runtimes"])
	ie.Result.Tools = filterCategory(ie.Score.Tools, Thresholds["tools"])
	ie.Result.PackageManagers = filterCategory(ie.Score.PackageManagers, Thresholds["package_managers"])
	ie.Result.Configuration = filterCategory(ie.Score.Configuration, Thresholds["configuration"])
	ie.Result.Language = ie.Score.Language
	return ie.Result
}
