import validator from "validator"
import { RequestValidateError } from "../api-helpers/error"

export let validateDates = (startDateString: string, endDateString: string) => {
    return isDateRangeValid(startDateString, endDateString)
}

export let validateDate = (dateString: string) => {
    if (!isValidDate(dateString)) {
        throw new RequestValidateError('invalid date format')
    }
}

let isValidDate = (dateString: string) => {
    if (validator.isISO8601(dateString as string)) {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }
    return false
}

let isDateRangeValid = (startDateString: string, endDateString: string) => {
    if (!isValidDate(startDateString)) {
        throw new RequestValidateError('startDate is invalid date format')
    }

    if (!isValidDate(endDateString)) {
        throw new RequestValidateError('endDate is invalid date format')
    }
    
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    if (endDate > startDate == false) {
        throw new RequestValidateError('Date range is invalid')
    }
}