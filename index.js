import verisure from 'verisure'
import minimist from 'minimist'
import {Logger, transports} from 'winston'
import 'winston-logstash'
import {CronJob} from 'cron'
import moment from 'moment'

import config from './secrets'

const argv = minimist(process.argv.slice(2))

const singleRun = argv['s']

const transportList = []

if (config.loggers.console) {
    transportList.push(new (transports.Console)({
        timestamp: true
    }))
}

if (config.loggers.file) {
    transportList.push(new (transports.File)({
        filename: config.file.filepath
    }))
}

if (config.loggers.logstash) {
    transportList.push(new (transports.Logstash)({
        port: config.logstash.port,
        host: config.logstash.host,
        max_connect_retries: -1,
        node_name: 'netatmo',
    }))
}

const logger = new Logger({
    transports: transportList
})

const validDuration = moment.duration({'hours' : 10})

const lastSeenValid = (now, lastSeen) => {
    return moment(now).subtract(validDuration).isBefore(moment(lastSeen))
}

const fetchData = () => {
    verisure.auth(config.auth.username, config.auth.password, function (err, token) {
        verisure.installations(token, config.auth.username, function (err, installations) {

            const station = installations[0].street

            verisure.overview(token, installations[0], function (err, overview) {

                logger.info({
                    station: station,
                    title: station,
                    arm_state: overview.armState.statusType,
                    ethernet_connected: overview.ethernetConnectedNow,
                    tags: ['verisure']
                })

                overview.doorWindow.doorWindowDevice.forEach((doorWindow) => {
                    logger.info({
                        module: doorWindow.area,
                        title: doorWindow.area,
                        state: doorWindow.state,
                        timestamp: doorWindow.reportTime,
                        tags: ['verisure', 'door_or_window']
                    })
                })

                overview.controlPlugs.forEach((plug) => {
                    logger.info({
                        module: plug.area,
                        title: plug.area,
                        state: plug.currentState,
                        tags: ['verisure', 'smart_plug']
                    })
                })

                const now = Date.now()

                overview.climateValues.forEach((climate) => {
                    if (lastSeenValid(now, climate.time)) {
                        const sensorName = config.sensors[climate.deviceType]

                        const data = {
                            module: climate.deviceArea,
                            title: `${climate.deviceArea} ${sensorName}`,
                            timestamp: climate.time,
                            tags: ['verisure', 'climate', climate.deviceType, sensorName]
                        }

                        if (climate.temperature) {
                            data['temperature'] = climate.temperature
                        }

                        if (climate.humidity) {
                            data['humidity'] = climate.humidity
                        }

                        logger.info(data)
                    }
                })
            })
        })
    })
}

fetchData()

if (!singleRun) {
    const job = new CronJob('00 */10 * * * *', () => {
        fetchData()
    }, null, null, 'Europe/Oslo')

    job.start()
}
