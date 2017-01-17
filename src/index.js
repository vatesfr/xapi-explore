import blessed from 'blessed'
import execPromise from 'exec-promise'
import minimist from 'minimist'
import pw from 'pw'
import { createClient } from 'xen-api'
import { forEach } from 'lodash'
import { name, version } from '../package.json'

// ===================================================================

const askPassword = prompt => new Promise(resolve => {
  prompt && process.stderr.write(`${prompt}: `)
  pw(resolve)
})

const required = name => {
  const e = `missing required argument <${name}>`
  throw e
}

// -------------------------------------------------------------------

execPromise(async args => {
  const opts = minimist(args, {
    boolean: [ 'help', 'version' ]
  })

  if (opts.help) {
    return `Usage: ${name} <Xen URL> <Xen user> [<Xen password>]`
  }

  if (opts.version) {
    return version
  }

  const [
    url = required('Xen URL'),
    user = required('Xen user'),
    password = await askPassword('Xen password')
  ] = opts._

  const xapi = createClient({
    auth: { user, password },
    url
  })

  console.log('connecting to %s…', url)
  await xapi.connect()

  const screen = blessed.Screen({
    smartCSR: true
  })
  screen.key([ 'escape', 'q', 'C-c' ], () => {
    screen.destroy()
  })

  const list = blessed.list({
    border: {
      type: 'line'
    },
    keys: true,
    mouse: true,
    parent: screen,
    style: {
      bg: 'black',
      fg: 'white',
      selected: {
        bg: 'white',
        fg: 'black'
      }
    }
  })

  xapi.objects.on('finish', items => {
    const byType = {}
    forEach(xapi.objects.all, item => {
      const nameLabel = item.name_label

      if (nameLabel) {
        const type = item.$type
        ;(byType[type] || (byType[type] = [])).push(nameLabel)
      }
    })

    const listItems = []
    forEach(Object.keys(byType).sort(), type => {
      listItems.push(`${type}/`)
      forEach(byType[type].sort(), item => {
        listItems.push(` - ${item}`)
      })
    })
    list.setItems(listItems)

    list.select(0)
    list.screen.render()
  })

  screen.render()
  await new Promise(resolve => screen.on('destroy', resolve))
  console.log('bye :-)')
})
