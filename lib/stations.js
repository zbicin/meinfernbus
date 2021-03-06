'use strict'

const csv = require('tiny-csv')

const fetch = require('./fetch')

const m = (a) => ((a===undefined) ? null : a)

const defaults = {
	key: 'k8LKgcuFoHnN5x/NdDYD6QSvjB4=',
	caching: true
}

const formatCountry = (country) => (country ? {name: m(country.name), code: m(country.alpha2_code)} : null)

const createStation = (station) => ({
    type: 'station',
	id: station.id + '',
	name: m(station.name),
	street: m(station.address),
	zip: station.zip,
	address: m(station.full_address),
	coordinates: m(station.coordinates),
	slug: m(station.slugs),
	aliases: (station.aliases ? csv(station.aliases) : null),
	regions: [m(+station.city_id)].filter((x) => !!x),
	connections: m(station.pairs),
	importance: m(+station.importance_order),
	country: formatCountry(station.country)
})

const stations = (opt) => {
	opt = Object.assign({}, defaults, opt || {})

	return fetch('network.json', {
		'X-API-Authentication': opt.key,
		'User-Agent': 'FlixBus/3.3 (iPhone; iOS 9.3.4; Scale/2.00)'
	})
	.then((data) => data.stations)
	.then((stations) => stations.map(createStation))
}

module.exports = stations
