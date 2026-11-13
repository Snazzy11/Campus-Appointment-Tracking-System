"""
Gets class schedule from data/test_schedule.py and adds schedule items in a json file
"""

import pdfplumber
import json
from dataclasses import dataclass
from datetime import datetime, time
from enum import Enum

SCHEDULE_ITEMS = []
    
class CLASS(Enum):
    SECTION = 0
    COURSE = 1
    TITLE = 2
    CREDITS = 3
    DAYS = 4
    TIME = 5
    DATES = 6
    LOCATION = 7
    DELIVERY = 8
    INSTRUCTOR = 9
    
@dataclass
class ScheduleItem: 
    days_of_week: list[str]
    start_time: time
    length: int
    tag: str
    location: str
    description: str
    title: str
    with_who: str
    is_repeating: bool

def create_dates(date):
    dates = date.split(" ")
    result_dates = []
    for date in dates:
        match date:
            case 'M':
                result_dates.append("Monday")
            case 'Tu':
                result_dates.append("Tuesday")
            case 'W':
                result_dates.append("Wednesday")
            case 'Th':
                result_dates.append("Thursday")
            case 'F':
                result_dates.append("Friday")
    return result_dates

def create_time(time):
    start_end_times = time.split("-")
    return start_end_times

def get_time(time):
    result = datetime.strptime(time, "%I:%M %p")
    return result 

# shoutout claude for this
def serialize(obj):
    if isinstance(obj, (time, datetime)):
        return obj.isoformat()   # "10:50:00"
    return vars(obj)

def add_class_schedule_item(days_of_week, times_for_class, title_for_class, professor_for_class, location_for_class, repeating):
    start_time = get_time(times_for_class[0].strip())
    end_time = get_time(times_for_class[1].strip())
    length = int((end_time - start_time).total_seconds() / 60)
    print(f"{title_for_class} is {length} minutes long")
    
    # formats professor name
    prof_name = professor_for_class.split(", ")
    prof_name = prof_name[1].strip() + " " + prof_name[0].strip()
    
    schedule_item = ScheduleItem(days_of_week, start_time.time(), length, "class", location_for_class, "", title_for_class, prof_name, repeating)
    SCHEDULE_ITEMS.append(schedule_item)
    
def main() -> None:
    print("Reading schedule pdf...")
    schedule = open("data/test_schedule.pdf", "rb")
    
    with pdfplumber.open(schedule) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for data in table[1::]: # skips the first row since it has the title for each column in the pdf
                    # creates schedule item based on days in schedule
                    dates_for_class = create_dates(data[CLASS.DAYS.value])
                    times_for_class = create_time(data[CLASS.TIME.value])
                    title_for_class = data[CLASS.TITLE.value]
                    location_for_class = data[CLASS.LOCATION.value]
                    professor_for_class = data[CLASS.INSTRUCTOR.value]
                    is_repeating = False
                    
                    if len(dates_for_class) > 1:
                        is_repeating = True
                        
                    add_class_schedule_item(dates_for_class, times_for_class, title_for_class, professor_for_class, location_for_class, is_repeating)
            
    
    with open("data/schedule_info.json", "w") as fp:
        fp.write(json.dumps(SCHEDULE_ITEMS, default=serialize, indent=4))
    
    print("Finished getting class schedule info")
    
if __name__ == "__main__":
    main()