package lynx

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var wordRegex = regexp.MustCompile(`[a-zA-Z0-9_]+`)

type Evidence struct {
	FileExtension map[string]int `json:"file_extension"`
	Files         map[string]int `json:"files"`
	Directories   map[string]int `json:"directories"`
	Dependencies  map[string]int `json:"dependencies"`
}

func NewEvidence() *Evidence {
	return &Evidence{
		FileExtension: make(map[string]int),
		Files:         make(map[string]int),
		Directories:   make(map[string]int),
		Dependencies:  make(map[string]int),
	}
}

func (e *Evidence) Merge(other *Evidence) {
	for k, v := range other.FileExtension {
		e.FileExtension[k] += v
	}
	for k, v := range other.Files {
		e.Files[k] += v
	}
	for k, v := range other.Directories {
		e.Directories[k] += v
	}
	for k, v := range other.Dependencies {
		e.Dependencies[k] += v
	}
}

func GetStackEvidenceValue(filename string) int {
	if val, ok := StackEvidence[filename]; ok {
		return val
	}
	ext := filepath.Ext(filename)
	if val, ok := StackEvidence["*"+ext]; ok {
		return val
	}
	return 0
}

func hasValidMatch(data, key string) bool {
	start := 0
	keyLen := len(key)
	dataLen := len(data)
	if keyLen == 0 || dataLen == 0 {
		return false
	}

	firstChar := key[0]
	lastChar := key[keyLen-1]
	firstIsWord := (firstChar >= 'a' && firstChar <= 'z') || (firstChar >= 'A' && firstChar <= 'Z') || (firstChar >= '0' && firstChar <= '9') || firstChar == '_'
	lastIsWord := (lastChar >= 'a' && lastChar <= 'z') || (lastChar >= 'A' && lastChar <= 'Z') || (lastChar >= '0' && lastChar <= '9') || lastChar == '_'

	for {
		idx := strings.Index(data[start:], key)
		if idx == -1 {
			return false
		}
		actualIdx := start + idx

		if firstIsWord && actualIdx > 0 {
			prev := data[actualIdx-1]
			if (prev >= 'a' && prev <= 'z') || (prev >= 'A' && prev <= 'Z') || (prev >= '0' && prev <= '9') || prev == '_' {
				start = actualIdx + 1
				continue
			}
		}

		if lastIsWord && actualIdx+keyLen < dataLen {
			next := data[actualIdx+keyLen]
			if (next >= 'a' && next <= 'z') || (next >= 'A' && next <= 'Z') || (next >= '0' && next <= '9') || next == '_' {
				start = actualIdx + 1
				continue
			}
		}

		return true
	}
}

func DetectDependencies(data string) []string {
	wordsList := wordRegex.FindAllString(data, -1)
	wordSet := make(map[string]bool, len(wordsList))
	for _, w := range wordsList {
		wordSet[w] = true
	}

	var detected []string
	for key, stack := range DependencyKeywords {
		parts := wordRegex.FindAllString(key, -1)
		if len(parts) == 0 {
			continue
		}

		allFound := true
		for _, p := range parts {
			if !wordSet[p] {
				allFound = false
				break
			}
		}
		if !allFound {
			continue
		}

		if len(parts) == 1 && parts[0] == key {
			detected = append(detected, stack)
		} else {
			if hasValidMatch(data, key) {
				detected = append(detected, stack)
			}
		}
	}
	return detected
}

func fileReader(path string, evidence *Evidence, value int) {
	// Limit read size to 1MB to avoid reading huge generated files
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	buf := make([]byte, 1024*1024)
	n, _ := f.Read(buf)
	if n == 0 {
		return
	}
	data := string(buf[:n])

	detected := DetectDependencies(data)
	for _, stack := range detected {
		evidence.Dependencies[stack] += value
	}
}

func ScanDir(pathDir string, rootDir string) *Evidence {
	if rootDir == "" {
		rootDir = pathDir
	}

	node := NewEvidence()
	entries, err := os.ReadDir(pathDir)
	if err != nil {
		return node
	}

	for _, entry := range entries {
		name := entry.Name()
		fullPath := filepath.Join(pathDir, name)

		if entry.IsDir() {
			node.Directories[name]++
			if IgnoredDirs[name] || strings.HasPrefix(name, ".") {
				continue
			}
			child := ScanDir(fullPath, rootDir)
			node.Merge(child)
		} else {
			relPath, err := filepath.Rel(rootDir, fullPath)
			if err != nil {
				relPath = name
			}
			// normalize slashes for cross-platform compatibility
			relPath = filepath.ToSlash(relPath)

			stackVal := GetStackEvidenceValue(name)
			if stackVal > 0 {
				fileReader(fullPath, node, stackVal)
			}

			node.Files[relPath]++
			ext := filepath.Ext(name)
			if ext != "" {
				node.FileExtension[ext]++
			}
		}
	}

	return node
}
