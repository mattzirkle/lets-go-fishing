import { Component } from 'react';
import { CardInfo } from '../services/dbSvc';
import * as Constants from '../utilities/constants';
import { Card, CardDragEventHandler } from './card';
import { Zone } from './gameLayout';

function getCSSNumber(elem: Element | null, propertyName : string) {
    return !elem ? 0 : parseFloat(
        getComputedStyle(elem).getPropertyValue(propertyName)
    );
}

interface HandProps {
    contents: CardInfo[];
    onCardDragStart: CardDragEventHandler;
    onCardDragStop: CardDragEventHandler;
}

interface HandState {
    width: number;
}

export default class Hand extends Component<HandProps, HandState> {
    private container: HTMLDivElement | null = null;

    state: HandState = {
        width: 0,
    }

    updateWidth = () => this.setState({ width: this.container!.clientWidth });

    componentDidMount() {
        this.updateWidth();
        window.addEventListener('resize', this.updateWidth);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.updateWidth);
    }

    getOverlapPx() {
        const leftPad = getCSSNumber(this.container, 'padding-left');
        const rightPad = getCSSNumber(this.container, 'padding-right');
        const handWidthPx = this.state.width - leftPad - rightPad;
        const handSize = this.props.contents.length;
        return Math.max(
            0,
            Math.ceil(
                (handSize * Constants.CARD_WIDTH_PX - handWidthPx) /
                (handSize - 1)
            )
        );
    }

    fireCardDragStart = (info: CardInfo, elem: HTMLElement) => {
        return this.props.onCardDragStart(info, elem);
    }

    fireCardDragStop = (info: CardInfo, elem: HTMLElement) => {
        return this.props.onCardDragStop(info, elem);
    }

    render() {
        const { contents } = this.props;
        const overlapPx = -this.getOverlapPx() + "px";
        return (
            <div 
            ref={div => { this.container = div }} 
            id={Zone.Hand}
            className="hand zone"
        >
                {contents.map((cardInfo, index) => {
                    return <Card
                        key={cardInfo.id}
                        info={cardInfo}
                        style={{marginLeft: index === 0 ? 0 : overlapPx}}
                        onDragStart={this.fireCardDragStart}
                        onDragStop={this.fireCardDragStop}
                    />
                })}
            </div>
        );
    }
}
