import React from 'react';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import IconButton from '@material-ui/core/IconButton';
import Badge from '@material-ui/core/Badge';
import PlayArrow from '@material-ui/icons/PlayArrow';
import SaveIcon from '@material-ui/icons/Save';
import { ListItem, ListItemIcon, ListItemText, TextareaAutosize, Tooltip } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import GetAppIcon from '@material-ui/icons/GetApp';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { useTheme, withStyles } from '@material-ui/core/styles';
import { connect } from "react-redux";
import { getDashboardJson } from './ModalSelectors';
import { valueIsArray, valueIsObject } from '../report/RecordProcessing';

/**
 * A modal to save a dashboard as a JSON text string.
 * The button to open the modal is intended to use in a drawer at the side of the page.
 */

const styles = {

};

/**
 * Removes the specified set of keys from the nested dictionary.
 */
const filterNestedDict = (value: any, removedKeys: any[]) => {

    if (value == undefined) {
        return value;
    }

    if (valueIsArray(value)) {
        return value.map(v => filterNestedDict(v, removedKeys));
    }

    if (valueIsObject(value)) {
        const newValue = {};
        Object.keys(value).forEach(k => {

            if (removedKeys.indexOf(k) != -1) {
                newValue[k] = undefined;
            } else {
                newValue[k] = filterNestedDict(value[k], removedKeys);
            }
        });
        return newValue;
    }
    return value;
}
export const NeoSaveModal = ({ dashboard }) => {
    const [open, setOpen] = React.useState(false);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

    const filteredDashboard = filterNestedDict(dashboard, ["fields", "settingsOpen", "advancedSettingsOpen", "collapseTimeout"]);
    const dashboardString = JSON.stringify(filteredDashboard, null, 2);
    const downloadDashboard = () => {
        const element = document.createElement("a");
        const file = new Blob([dashboardString], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "dashboard.json";
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    }

    return (
        <div>
            <ListItem button onClick={handleClickOpen}>
                <ListItemIcon>
                    <IconButton style={{ padding: "0px" }} >
                        <SaveIcon />
                    </IconButton>
                </ListItemIcon>
                <ListItemText primary="Save" />
            </ListItem>

            <Dialog maxWidth={"lg"} open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">
                    <SaveIcon style={{
                        height: "30px",
                        paddingTop: "4px",
                        marginBottom: "-8px",
                        marginRight: "5px",
                        paddingBottom: "5px"
                    }} />
                    Save Dashboard JSON
                   
                    <IconButton onClick={handleClose} style={{ padding: "3px", float: "right" }}>
                        <Badge badgeContent={""} >
                            <CloseIcon />
                        </Badge>
                    </IconButton>
                    <Button onClick={downloadDashboard}
                        style={{ float: "right", marginRight: "20px", backgroundColor: "white" }}
                        color="default"
                        variant="contained"
                        size="small"
                        endIcon={<GetAppIcon />}>
                        Download File
                    </Button>
                </DialogTitle>
                <DialogContent style={{ width: "1000px" }}>

                    <DialogContentText>
                        Copy the text below to save your dashboard. You can load the dashboard back into NeoDash later.</DialogContentText>
                    <TextareaAutosize
                        style={{ minHeight: "500px", width: "100%", border: "1px solid lightgray" }}
                        className={"textinput-linenumbers"}
                        value={dashboardString}
                        aria-label=""
                        placeholder="Your dashboard JSON should show here" />
                </DialogContent>
                <DialogActions>

                </DialogActions>
            </Dialog>
        </div>
    );
}

const mapStateToProps = state => ({
    dashboard: getDashboardJson(state)
});

const mapDispatchToProps = dispatch => ({

});

//  
export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(NeoSaveModal));



