/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { inject, injectable, postConstruct } from 'inversify';
import { Message, StatefulWidget } from '@theia/core/lib/browser';
import { OutputChannelManager, OutputChannel } from '../common/output-channel';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import * as React from 'react';

import '../../src/browser/style/output.css';

export const OUTPUT_WIDGET_KIND = 'outputView';

@injectable()
export class OutputWidget extends ReactWidget implements StatefulWidget {

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    protected readonly lockedChannels = new Set<string>();

    constructor() {
        super();
        this.id = OUTPUT_WIDGET_KIND;
        this.title.label = 'Output';
        this.title.caption = 'Output';
        this.title.iconClass = 'fa output-tab-icon';
        this.title.closable = true;
        this.addClass('theia-output');
        this.node.tabIndex = 0;
    }

    @postConstruct()
    protected init(): void {
        this.outputChannelManager.getChannels().forEach(this.registerListener.bind(this));
        this.toDispose.push(this.outputChannelManager.onChannelAdded(channel => {
            this.registerListener(channel);
            this.update();
        }));
        this.toDispose.push(this.outputChannelManager.onSelectedChannelChange(event => {
            this.update();
        }));
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const channelSelector = document.getElementById(OutputWidget.IDs.CHANNEL_LIST);
        if (channelSelector) {
            channelSelector.focus();
        } else {
            this.node.focus();
        }
    }

    protected registerListener(outputChannel: OutputChannel): void {
        this.toDispose.push(outputChannel.onContentChange(c => {
            if (outputChannel === this.outputChannelManager.selectedChannel) {
                this.update();
            }
        }));
    }

    protected render(): React.ReactNode {
        return <React.Fragment>
            {this.renderChannelContents()}
        </React.Fragment>;
    }

    clear(): void {
        if (this.outputChannelManager.selectedChannel) {
            this.outputChannelManager.selectedChannel.clear();
        }
    }

    selectAll(): void {
        if (this.outputChannelManager.selectedChannel) {
            const element = document.getElementById(OutputWidget.IDs.CONTENTS);
            if (element) {
                const selectElementContent = (htmlElement: HTMLElement) => {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    if (selection && range) {
                        range.selectNodeContents(htmlElement);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                };
                element.focus();
                selectElementContent(element);
            }
        }
    }

    /**
     * `channelName` defaults to the name of the currently selected channel, or `undefined`.
     */
    toggleScrollLock(channelName: string | undefined = (this.outputChannelManager.selectedChannel ? this.outputChannelManager.selectedChannel.name : undefined)): void {
        if (!channelName) {
            return;
        }
        const channel = this.outputChannelManager.getChannel(channelName);
        if (!channel) {
            return;
        }
        const isLocked = this.lockedChannels.has(channelName);
        if (isLocked) {
            this.lockedChannels.delete(channelName);
        } else {
            this.lockedChannels.add(channelName);
        }
    }

    isLocked(channelName: string | undefined = (this.outputChannelManager.selectedChannel ? this.outputChannelManager.selectedChannel.name : undefined)): boolean {
        if (!channelName) {
            return false;
        }
        const channel = this.outputChannelManager.getChannel(channelName);
        if (!channel) {
            return false;
        }
        return this.lockedChannels.has(channelName);
    }

    protected renderChannelContents(): React.ReactNode {
        return <div id={OutputWidget.IDs.CONTENTS}>{this.renderLines()}</div>;
    }

    protected renderLines(): React.ReactNode[] {
        let id = 0;
        const result = [];

        const style: React.CSSProperties = {
            whiteSpace: 'pre',
            fontFamily: 'monospace',
        };

        if (this.outputChannelManager.selectedChannel) {
            for (const text of this.outputChannelManager.selectedChannel.getLines()) {
                const lines = text.split(/[\n\r]+/);
                for (const line of lines) {
                    result.push(<div style={style} key={id++}>{line}</div>);
                }
            }
        }
        if (result.length === 0) {
            result.push(<div style={style} key={id++}>{'<no output yet>'}</div>);
        }
        return result;
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        const isLocked = this.outputChannelManager.selectedChannel ? this.lockedChannels.has(this.outputChannelManager.selectedChannel.name) : false;
        if (!isLocked) {
            setTimeout(() => {
                const div = document.getElementById(OutputWidget.IDs.CONTENTS) as HTMLDivElement;
                if (div && div.children.length > 0) {
                    div.children[div.children.length - 1].scrollIntoView(false);
                }
            });
        }
    }

    storeState(): object {
        const existingChannelIds = new Set(this.outputChannelManager.getChannels().map(({ name }) => name));
        return Array.from(this.lockedChannels).filter(id => existingChannelIds.has(id));
    }

    restoreState(oldState: object): void {
        if (Array.isArray(oldState)) {
            for (const item of oldState) {
                if (typeof item === 'string') {
                    this.lockedChannels.add(item);
                }
            }
        }
    }

}

export namespace OutputWidget {
    export namespace IDs {
        export const CONTENTS = 'outputContents';
        export const CHANNEL_LIST = 'outputChannelList';
    }
}
