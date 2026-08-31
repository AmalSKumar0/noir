import os
import re
from pathlib import Path
from typing import Union, Optional
from noir.lynx_engine.data import IGNORE, STACK_EVIDENCE, DEPENDENCY_KEYWORDS

WORD_RE = re.compile(r'[a-zA-Z0-9_]+')

STACK_EVIDENCE_EXACT = {}
STACK_EVIDENCE_SUFFIX = {}
for key, val in STACK_EVIDENCE.items():
    if key.startswith('*.'):
        STACK_EVIDENCE_SUFFIX[key[1:]] = val
    else:
        STACK_EVIDENCE_EXACT[key] = val


def get_stack_evidence_value(filename: str) -> int:
    if filename in STACK_EVIDENCE_EXACT:
        return STACK_EVIDENCE_EXACT[filename]
    _, ext = os.path.splitext(filename)
    if ext in STACK_EVIDENCE_SUFFIX:
        return STACK_EVIDENCE_SUFFIX[ext]
    return 0


class Evidence:

    def __init__(self):
        self.file_extension = {}
        self.files = {}
        self.directories = {}
        self.dependencies = {}
    
    def merge(self, data_of_child: "Evidence"):
        for key, value in data_of_child.file_extension.items():
            self.file_extension[key] = self.file_extension.get(key, 0) + value
        
        for key, value in data_of_child.files.items():
            self.files[key] = self.files.get(key, 0) + value
        
        for key, value in data_of_child.directories.items():
            self.directories[key] = self.directories.get(key, 0) + value
        
        for key, value in data_of_child.dependencies.items():
            self.dependencies[key] = self.dependencies.get(key, 0) + value
            
    def export_evidence(self):
        return self.file_extension

    def export_files(self):
        return self.files
    
    def export_dependencies(self):
        return self.dependencies

    def display(self):
        return self.__dict__


def has_valid_match(data: str, key: str) -> bool:
    start = 0
    key_len = len(key)
    data_len = len(data)
    first_char = key[0]
    last_char = key[-1]
    first_is_word = first_char.isalnum() or first_char == '_'
    last_is_word = last_char.isalnum() or last_char == '_'
    
    while True:
        idx = data.find(key, start)
        if idx == -1:
            return False
        
        if first_is_word and idx > 0:
            prev_char = data[idx - 1]
            if prev_char.isalnum() or prev_char == '_':
                start = idx + 1
                continue
                
        if last_is_word and idx + key_len < data_len:
            next_char = data[idx + key_len]
            if next_char.isalnum() or next_char == '_':
                start = idx + 1
                continue
                
        return True


def detect_dependencies(data: str) -> list:
    words = set(WORD_RE.findall(data))
    detected = []
    for key, stack in DEPENDENCY_KEYWORDS.items():
        parts = WORD_RE.findall(key)
        if not parts:
            continue
        
        if not all(p in words for p in parts):
            continue
            
        if len(parts) == 1 and parts[0] == key:
            detected.append(stack)
        else:
            if has_valid_match(data, key):
                detected.append(stack)
                
    return detected


def file_reader(path: Path, evidence: Evidence, value: int):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as file:
            data = file.read()
    except Exception:
        return
        
    detected = detect_dependencies(data)
    for stack in detected:
        evidence.dependencies[stack] = evidence.dependencies.get(stack, 0) + value


def scan(path_dir: Union[str, Path], root_dir: Optional[Path] = None) -> Evidence:
    path_dir = Path(path_dir).expanduser()
    if root_dir is None:
        root_dir = path_dir

    node = Evidence()
    try:
        for entry in os.scandir(path_dir):
            item = entry.name
            path = Path(entry.path)

            if entry.is_dir():
                node.directories[item] = node.directories.get(item, 0) + 1
                if item in IGNORE or item.startswith('.'):
                    continue
                child = scan(path, root_dir=root_dir)
                node.merge(child)
            else:
                rel_path = str(path.relative_to(root_dir))
                stack_val = get_stack_evidence_value(item)
                if stack_val > 0:
                    file_reader(path, node, stack_val)

                node.files[rel_path] = node.files.get(rel_path, 0) + 1
                _, extension = os.path.splitext(item)
                if extension:
                    node.file_extension[extension] = node.file_extension.get(extension, 0) + 1
    except PermissionError:
        pass

    return node
