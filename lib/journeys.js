'use strict'

const moment = require('moment-timezone')
const fill = require('lodash.fill')

const fetch = require('./fetch')

const formatInputDate = (date) => moment(date).tz('Europe/Berlin').format('DD.MM.YYYY')
const formatOutputDate = (date) => moment.unix(+date.timestamp).utcOffset(date.tz).toDate()

const transformOperator = (o) => ({
    type: 'operator',
    id: o.key,
    name: o.label,
    url: o.url,
    address: o.address
})
// const formatDuration = (duration) => (+duration.hour*60)+(+duration.minutes)

const m = (a) => ((a===undefined) ? null : a)

const transformStation = (s) => ({
    type: 'station',
    subtype: 'station', // todo: always correct?
    id: s.id,
    name: s.name,
    importance: s.importance_order || null
})

const defaults = {
	adults: 1,
	children: 0,
	bikes: 0,
	currency: 'EUR',
	search_by: 'cities',
	back: 0, // ???
	key: 'uR=s7k6m=[cCS^zY86H8CNAnkC6n'
}

const extractLegs = (origin, destination, departure, arrival, operators, transfers) => {
    const legs = []
    operators = operators.map(transformOperator)
    if(operators.length === 1) operators = fill(Array((transfers.length || 0)+1), operators[0])
    else if(operators.length !== (transfers.length || 0)+1) operators = null
    if(transfers && transfers.length){
        // first leg
        legs.push({
            origin: transformStation(origin),
            destination: transformStation({id: transfers[0].station_id, name: transfers[0].station_name}),
            departure: formatOutputDate(departure),
            arrival: formatOutputDate(transfers[0].arrival),
            // shuttle: transfers[0].shuttle_transfer,
            // message: transfers[0].message, // TODO !!
            operator: operators ? operators[0] : undefined
        })

        // middle legs

        for(let i = 1; i < transfers.length-1; i++) legs.push({
            origin: transformStation({id: transfers[i].station_id, name: transfers[i].station_name}),
            destination: transformStation({id: transfers[i+1].station_id, name: transfers[i+1].station_name}),
            departure: formatOutputDate(transfers[i].departure),
            arrival: formatOutputDate(transfers[i+1].arrival),
            operator: operators ? operators[i] : undefined
        })

        // last legs
        legs.push({
            origin: transformStation({id: transfers[transfers.length-1].station_id, name: transfers[transfers.length-1].station_name}),
            destination: transformStation(destination),
            departure: formatOutputDate(transfers[transfers.length-1].departure),
            arrival: formatOutputDate(arrival),
            // shuttle: transfers[transfers.length-1].shuttle_transfer,
            // message: transfers[transfers.length-1].message,
            operator: operators ? operators[transfers.length-1] : undefined
        })

    }
    else{
        legs.push({
            origin: transformStation(origin),
            destination: transformStation(destination),
            departure: formatOutputDate(departure),
            arrival: formatOutputDate(arrival),
            operator: operators ? operators[0] : undefined
        })
    }
    return legs
}

const transformTransfer = (transfer) => ({
	station: {
		id: transfer.station_id,
		name: m(transfer.station_name)
	},
	arrival: formatOutputDate(transfer.arrival),
	departure: formatOutputDate(transfer.departure),
	duration: formatDuration(transfer.duration),
	shuttle: m(transfer.shuttle_transfer),
	message: m(transfer.message)
})

const transformJourney = (origin, destination) => (trip) => ({
    type: 'journey',
	origin: transformStation(origin),
	destination: transformStation(destination),
	id: m(trip.id), // ???
    direct: (m(trip.type)==='direct') ? true : false, // direct / interconnection
	rides: m(trip.rides_uids), // ???
	departure: formatOutputDate(trip.departure),
	arrival: formatOutputDate(trip.arrival),
	// duration: formatDuration(trip.duration),
    legs: extractLegs(origin, destination, trip.departure, trip.arrival, trip.operated_by, trip.interconnection_transfers),
	status: m(trip.status),
	borders: m(trip.transborder),
	available: m(trip.available),
	operators: (m(trip.operated_by) || []).map(transformOperator),
	// transfers: (trip.interconnection_transfers ? trip.interconnection_transfers.map(transformTransfer) : null),
    price: {
        amount: m(trip.price_total_sum) || null, // bad hack
        currency: 'EUR',
        discounts: m(trip.discounts), // ???
        sale_restriction: m(trip.sale_restriction), // ???
        available: (trip.status === 'full') ? false : true // is this correct?
    },
	info: {
		title: m(trip.info_title),
		hint: m(trip.info_title_hint),
		message: m(trip.info_message)
	},
	warnings: m(trip.warnings)
})

const transformJourneys = (journeys) => {
	let result = []
	journeys.forEach((journey) => result.push(...journey.items.map(transformJourney(journey.from, journey.to))))
	return result
}



const journeys = (origin, destination, date, opt) => {
	opt = Object.assign({}, defaults, opt || {})

	return fetch('trip/search.json', {
		'X-API-Authentication': opt.key,
		'User-Agent': 'FlixBus/3.3 (iPhone; iOS 9.3.4; Scale/2.00)',
		'X-User-Country': 'de'
	}, {
		from: +origin,
		to: +destination,
		departure_date: formatInputDate(date),
		return_date: null,
		back: +opt.back,
		search_by: opt.search_by,
		currency: opt.currency,
		adult: +opt.adults,
		children: +opt.children,
		bikes: +opt.bikes
	})
    .then((data) => data.trips)
	.then((data) => transformJourneys(data))
}

module.exports = journeys