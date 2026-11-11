import pdfplumber
schedule = None
CLASSES = []


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
    
    def __init__(self, section: str | None, course_code: str | None, course_title: str | None, credits: str | None, days: str | None, times: str | None, dates: str | None, location: str | None, delivery: str | None, instructor_name: str | None):
        self.section = section
        self.course_code = course_code
        self.course_title = course_title
        self.credits = credits
        self.days = days
        self.times = times
        self.dates = dates
        self.location = location
        self.delivery = delivery
        self.instructor_name = instructor_name
    
def main() -> None:
    print("Reading schedule pdf...")
    schedule = open("data/schedule.pdf", "rb")
    with pdfplumber.open(schedule) as pdf:
        for p in pdf.pages:
            for t in p.extract_tables():
                for r in t:
                    class_item = Class(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]);   
                    CLASSES.append(class_item)
    
    for class_item in CLASSES:
        print(class_item.section + " " + class_item.course_title + " " + class_item.instructor_name)
    
if __name__ == "__main__":
    main()