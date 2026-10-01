import { IConcept } from './concerto@1.0.0';
export declare enum Month {
    January = "January",
    February = "February",
    March = "March",
    April = "April",
    May = "May",
    June = "June",
    July = "July",
    August = "August",
    September = "September",
    October = "October",
    November = "November",
    December = "December"
}
export declare enum Day {
    Monday = "Monday",
    Tuesday = "Tuesday",
    Wednesday = "Wednesday",
    Thursday = "Thursday",
    Friday = "Friday",
    Saturday = "Saturday",
    Sunday = "Sunday"
}
export declare enum TemporalUnit {
    seconds = "seconds",
    minutes = "minutes",
    hours = "hours",
    days = "days",
    weeks = "weeks"
}
export interface IDuration extends IConcept {
    amount: number;
    unit: TemporalUnit;
}
export declare enum PeriodUnit {
    days = "days",
    weeks = "weeks",
    months = "months",
    quarters = "quarters",
    years = "years"
}
export interface IPeriod extends IConcept {
    amount: number;
    unit: PeriodUnit;
}
