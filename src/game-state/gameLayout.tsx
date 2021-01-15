import React, { Component } from 'react';
import DeckLookup from '../other-components/deckLookup';
import { DeckInfoService } from '../services/deckInfoSvc';
import { DatabaseService } from '../services/dbSvc';
import * as Constants from '../utilities/constants';
import { shuffle } from '../utilities/helpers';
import { CardInfo, DragInfo } from './card';
import { Zone, ZoneCardInfo } from './zone';
import { StackZone } from './stackZone';

export const ZoneName = {
    None: 'none',
    Library: 'library',
    Hand: 'hand',
    Battlefield: 'battlefield',
};

interface GameLayoutState {
    loading: boolean;
    zones: { [domId: string]: ZoneCardInfo[] };
    drag?: DragInfo;
}

export default class GameLayout extends Component<{}, GameLayoutState> {
    state: GameLayoutState = {
        loading: false,
        zones: {
            [ZoneName.Library]: [],
            [ZoneName.Hand]: [],
            [ZoneName.Battlefield]: [],
        },
    }

    async componentDidMount() {
        const decklist = await DatabaseService.getDeck();
        if (decklist) this.startGame(decklist);
    }

    importDeck(deckUrl: string) {
        this.showLoadingState();
        DeckInfoService.getDecklist(deckUrl)
            .then(decklist => this.startGame(decklist));
    }

    startGame(decklist: CardInfo[]) {
        this.shuffleDeck(decklist);
        this.draw(Constants.STARTING_HAND_SIZE);
    }

    shuffleDeck(decklist: CardInfo[]) {
        this.setState({
            loading: false,
            zones: {
                ...this.state.zones,
                [ZoneName.Library]: shuffle(decklist).map(card => ({ card })),
            },
        });
    }

    draw(num = 1) {
        const { loading, zones } = this.state;
        if (loading) return;
        const handCards = zones[ZoneName.Hand];
        const libraryCards = zones[ZoneName.Library];
        const cutIndex = libraryCards.length - num;
        this.setState({
            zones: {
                ...zones,
                [ZoneName.Hand]: handCards.concat(libraryCards.slice(cutIndex)),
                [ZoneName.Library]: libraryCards.slice(0, cutIndex),
            },
        });
    }

    showLoadingState() {
        this.setState({ loading: true });
    }

    sliceCardFromZone(card: CardInfo, zone: string) {
        const sourceCards = this.state.zones[zone];
        const sourceCardIndex = sourceCards.findIndex(
            zoneCard => zoneCard.card.id === card.id
        );
        return sourceCards
            .slice(0, sourceCardIndex)
            .concat(sourceCards.slice(sourceCardIndex + 1));
    }

    getZoneCardAfterDrag(drag: DragInfo) {
        const { card, node, targetZone } = drag;
        if (targetZone !== ZoneName.Battlefield) return { card };

        const cardRect = node.getBoundingClientRect();
        const zoneRect =
            document.getElementById(targetZone!)!.getBoundingClientRect();
        return {
            card,
            x: cardRect.left - zoneRect.left,
            y: cardRect.top - zoneRect.top,
        };
    }

    onDragCardStart = (drag: DragInfo) => {
        this.setState({ drag });
        return true;
    }

    onDragCardStop = () => {
        const { zones, drag } = this.state;
        if (!drag) return false;
        const { card, sourceZone, targetZone } = drag;
        this.setState({ drag: undefined });

        if (!sourceZone || targetZone === ZoneName.None) return false;

        // If the card was clicked without dragging:
        if (!targetZone) {
            if (sourceZone !== ZoneName.Library) return false;
            this.draw();
            return true;
        }

        // If the card was dragged within a zone that is not the Battlefield:
        if (sourceZone === targetZone && sourceZone !== ZoneName.Battlefield) {
            return false;
        }

        const zoneCard = this.getZoneCardAfterDrag(drag);
        const sourceZoneCards = this.sliceCardFromZone(card, sourceZone);
        if (sourceZone === targetZone) {
            this.setState({
                zones: {
                    ...zones,
                    [sourceZone]: sourceZoneCards.concat(zoneCard)
                }
            });
            return false;
        }
        this.setState({
            zones: {
                ...zones,
                [sourceZone]: sourceZoneCards,
                [targetZone]: zones[targetZone].concat(zoneCard),
            }
        });
        return true;
    }

    onMouseMove(e: React.MouseEvent) {
        const { drag } = this.state;
        if (!drag) return;
        const mouseOverElems = document.elementsFromPoint(e.clientX, e.clientY);
        const targetElem = mouseOverElems.find(
            elem => elem.classList.contains('zone')
        );
        this.setState({
            drag: {
                ...drag,
                targetZone: targetElem ? targetElem.id : ZoneName.None,
            }
        });
    }

    render() {
        const { zones, drag } = this.state;
        const zoneProps = {
            drag,
            onCardDragStart: this.onDragCardStart,
            onCardDragStop: this.onDragCardStop,
        };
        return (
            <>
                <div className="topPanel">
                    <DeckLookup
                        onImportClick={deckUrl => this.importDeck(deckUrl)}
                    />
                </div>
                <div
                    className="gameLayout"
                    onMouseMove={e => this.onMouseMove(e)}
                >
                    <Zone
                        {...zoneProps}
                        name={ZoneName.Battlefield} 
                        contents={zones[ZoneName.Battlefield]}
                    />
                    <div className="bottomPanel">
                        <StackZone 
                            {...zoneProps}
                            name={ZoneName.Hand}
                            contents={zones[ZoneName.Hand]}
                            enablePreview={true}
                        />
                        <StackZone 
                            {...zoneProps}
                            name={ZoneName.Library}
                            contents={zones[ZoneName.Library]}
                            faceDown={true} 
                            maxToShow={2}
                        />
                    </div>
                </div>
            </>
        );
    }
}
