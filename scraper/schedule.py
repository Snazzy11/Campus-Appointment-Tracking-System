"""
Gets class schedule from data/test_schedule.py and adds info to a json file.
"""

import pdfplumber
import json
from dataclasses import dataclass

schedule = None
CLASSES = []

@dataclass
# don't ask me why it's str or none for each, it was complaining...
class Class:
    section: str | None
    course_code: str | None
    course_title: str | None
    credits: str | None
    days: str | None
    times: str | None
    dates: str | None 
    location: str | None
    delivery: str | None
    instructor_name: str | None
    
def main() -> None:
    print("Reading schedule pdf...")
    schedule = open("data/test_schedule.pdf", "rb")
    with pdfplumber.open(schedule) as pdf:
        for p in pdf.pages:
            for t in p.extract_tables():
                for r in t:
                    class_item = Class(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]);   
                    CLASSES.append(class_item)
            
    
    with open("data/schedule_info.json", "w") as fp:
        # gets rid of the first row
        CLASSES.pop(0) 
        
        print("Class schedule Info...")
        for class_item in CLASSES:
            print(class_item.section + " " + class_item.course_title + " " + class_item.instructor_name)
            
        fp.write(json.dumps(CLASSES, default=vars))
    
    print("Finished getting class schedule info")
if __name__ == "__main__":
    main()