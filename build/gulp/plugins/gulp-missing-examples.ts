import gutil from 'gulp-util'
import _ from 'lodash'
import path from 'path'
import through2 from 'through2'
import Vinyl from 'vinyl'

import { MissingExample } from '@fluentui/docs/src/types'
import getComponentInfo from './util/getComponentInfo'
import { getMissingExamples } from '../../../docs/src/utils'
import { parseDocSection } from './util'

const pluginName = 'gulp-missing-examples'

export default () => {
  const result: MissingExample[] = []

  function bufferContents(file, enc, cb) {
    const exampleFilesByDisplayName: Record<
      string,
      Record<
        string,
        {
          sectionName: string
          examples: Record<string, any>
          order: number
        }
      >
    > = {}

    if (file.isNull()) {
      cb(null, file)
      return
    }

    if (file.isStream()) {
      cb(new gutil.PluginError(pluginName, 'Streaming is not supported'))
      return
    }

    gutil.log(file.path)

    try {
      const pathParts = _.split(file.path, path.sep).slice(-4)
      const displayName = pathParts[1]
      const sectionName = pathParts[2]
      const { examples } = parseDocSection(file.contents)

      _.merge(exampleFilesByDisplayName, {
        [displayName]: {
          [sectionName]: {
            sectionName,
            examples,
            order: getSectionOrder(sectionName),
          },
        },
      })

      cb()
    } catch (err) {
      const pluginError = new gutil.PluginError(pluginName, err)
      const relativePath = path.relative(process.cwd(), file.path)
      pluginError.message = [
        gutil.colors.magenta(`Error in file: ${relativePath}`),
        gutil.colors.red(err.message),
        gutil.colors.gray(err.stack),
      ].join('\n\n')
      this.emit('error', pluginError)
    }

    try {
      const componentInfo = getComponentInfo(file.path, [])

      if (componentInfo.isParent) {
        result.concat(getMissingExamples(componentInfo.displayName))
      }
      cb()
    } catch (err) {
      const pluginError = new gutil.PluginError(pluginName, err)
      const relativePath = path.relative(process.cwd(), file.path)
      pluginError.message = [
        gutil.colors.magenta(`Error in file: ${relativePath}`),
        gutil.colors.red(err.message),
        gutil.colors.gray(err.stack),
      ].join('\n\n')
      this.emit('error', pluginError)
    }
  }

  function endStream(cb) {
    const file = new Vinyl({
      path: './missingExamples.json',
      contents: Buffer.from(
        JSON.stringify(_.sortBy(result, ['info.displayName', 'prop.name']), null, 2),
      ),
    })

    this.push(file)
    cb()
  }

  return through2.obj(bufferContents, endStream)
}