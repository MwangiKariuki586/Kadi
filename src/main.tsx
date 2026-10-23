import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { initInstallPrompt } from './ui/install'

initInstallPrompt()

render(<App />, document.getElementById('app')!)
