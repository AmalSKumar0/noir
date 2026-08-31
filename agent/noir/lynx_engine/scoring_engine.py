import os
from noir.lynx_engine.evidence_collector import Evidence
from noir.lynx_engine.data import EXTENSION_TO_LANGUAGE, FILES_TO_TECHNOLOGY


class Score:
    def __init__(self):
        self.language = {
            "primary": [],
            "secondary": [],
            "supporting": []
        }
        self.frameworks = {}
        self.libraries = {}
        self.runtimes = {}
        self.tools = {}
        self.package_managers = {}
        self.configuration = {}
        self.file_read_data = {}
    
    def load_languages(self, language_raw_data: dict):
        for key, value in language_raw_data.items():
            if value >= 50:
                self.language["primary"].append(key)
            elif value >= 10:
                self.language["secondary"].append(key)
            else:
                self.language["supporting"].append(key)

    def display(self):
        return self.__dict__

    def putting_data(self, category, technology, count):
        target = getattr(self, category)
        target[technology] = target.get(technology, 0) + count


def filter_languages(languages):
    return {
        key: value
        for key, value in languages.items()
        if value >= 1.0 
    }


def language_scoring_engine(language_raw_data: dict, score: Score):
    lang = {}
    total = 0
    
    for key, value in language_raw_data.items():
        language = EXTENSION_TO_LANGUAGE.get(key)
        if language is None:
            continue
        
        total += value
        lang[language] = lang.get(language, 0) + value
    
    if total > 0:
        for key, value in lang.items():
            lang[key] = (value / total) * 100

    lang = filter_languages(lang)
    score.load_languages(lang)


BASENAME_TO_TECH = {}
SUFFIX_TO_TECH = {}
TECH_TO_CATEGORY = {}

for category, file_map in FILES_TO_TECHNOLOGY.items():
    for path_key, tech in file_map.items():
        TECH_TO_CATEGORY[tech] = category
        if '/' in path_key:
            SUFFIX_TO_TECH[path_key] = (category, tech)
        else:
            BASENAME_TO_TECH[path_key] = (category, tech)


def dependency_scoring_engine(dependencies_raw_data, score):
    for tech, count in dependencies_raw_data.items():
        category = TECH_TO_CATEGORY.get(tech, "libraries")
        score.putting_data(category, tech, count)


def framework_scoring_engine(files_raw_data, score):
    for rel_path, count in files_raw_data.items():
        basename = os.path.basename(rel_path)
        
        if basename in BASENAME_TO_TECH:
            category, technology = BASENAME_TO_TECH[basename]
            score.putting_data(category, technology, count)
            continue
            
        for suffix, (category, technology) in SUFFIX_TO_TECH.items():
            if rel_path.endswith(suffix):
                score.putting_data(category, technology, count)
                break


def scoreingEngine(evidence: Evidence):
    score = Score()
    data = evidence.export_evidence()
    language_scoring_engine(data, score)
    score.file_read_data = evidence.export_dependencies()
    dependency_scoring_engine(score.file_read_data, score)
    data = evidence.export_files()
    framework_scoring_engine(data, score)
    return score
